import { EventEmitter } from "node:events";
import {
  AcceptedConnection,
  ConnectionState,
  IAuthManager,
  ClientSession,
  IConnectionListener,
  MqttBrokerEvents,
} from "./types";
import {
  AnyPacketV4,
  ConnackPacketV4,
  ConnackReturnCodeV4,
  ConnectPacketV4,
} from "../protocol/v4/types";
import { PacketType } from "../protocol/shared/types";
import { MqttAuth } from "../shared/types";
import { MqttPacketV4Factory } from "../protocol/v4/MqttPacketV4Factory";
import { isBasicClientId } from "../protocol/v4/validation/connect";

export class MqttBroker extends EventEmitter<MqttBrokerEvents> {
  private nextConnectionId = 1; // for generating unique connection IDs

  private readonly connectionListeners = new Set<IConnectionListener>();
  private readonly connections = new Map<number, ConnectionState>();

  private readonly sessions = new Map<string, ClientSession>();

  private stopPromise?: Promise<void>;

  /**
   * Creates a new instance of the MQTT broker with the specified authentication manager.
   * @param auth The authentication manager to use for the broker.
   */
  constructor(private readonly auth: IAuthManager) {
    super();
  }

  /**
   * Adds a new connection listener to the broker.
   * @param listener The connection listener to add to the broker.
   */
  public addConnectionListener(listener: IConnectionListener): void {
    if (this.stopPromise) throw new Error("Broker is stopping or stopped.");

    if (this.connectionListeners.has(listener))
      throw new Error("Connection listener is already registered.");

    listener.connectionHandler = this.handleNewConnection;
    listener.closeHandler = (error) => {
      if (this.connectionListeners.delete(listener) && error)
        // emit a brokerError event if the listener is removed due to an error
        this.emit("brokerError", { source: "network-listener", error });
    };

    this.connectionListeners.add(listener);

    try {
      listener.listen();
    } catch (error) {
      this.connectionListeners.delete(listener);
      throw error;
    }
  }

  /**
   * Stops the broker and waits for its listeners and connections to stop.
   * @returns A promise that resolves when the broker has fully stopped.
   */
  public stop(): Promise<void> {
    if (!this.stopPromise) {
      this.stopPromise = Promise.resolve().then(() => this.stopResources());
    }

    return this.stopPromise;
  }

  /**
   * Stops all connection listeners and active connections, and waits for them to finish.
   * @returns A promise that resolves when all listeners and connections have stopped.
   */
  private async stopResources(): Promise<void> {
    // Stop all connection listeners and collect their stop promises.
    const tasks: Promise<void>[] = [...this.connectionListeners].map(
      (listener) => this.stopListener(listener)
    );

    // Stop all active connections and collect their stop promises.
    for (const connection of this.connections.values()) {
      connection.stopping = true;
      connection.phase = "closing";

      try {
        const task = connection.transport.disconnect();
        tasks.push(task);
      } catch (error) {
        tasks.push(Promise.reject(error));
      }
    }

    // Wait for all stop tasks to settle
    const results = await Promise.allSettled(tasks);

    // for now throw only the first rejection
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
    }
  }

  /**
   * Stops a connection listener and removes it from the broker.
   * @param listener The connection listener to stop and remove.
   */
  private async stopListener(listener: IConnectionListener): Promise<void> {
    await listener.stop();
    this.connectionListeners.delete(listener);
  }

  //
  // CONNECTION HANDLING
  //

  /**
   * Handles a new incoming connection and sets up its state and event handlers.
   * @param connection The new incoming connection to handle.
   */
  private handleNewConnection = (connection: AcceptedConnection) => {
    const { transport, info: connectionInfo } = connection;
    const connectionId = this.nextConnectionId++;
    const state: ConnectionState = {
      transport,
      stopping: false,
      phase: "beforeConnect",
    };

    // store the connection state in the connections map
    this.connections.set(connectionId, state);

    // attach event handlers to the transport of the connection
    this.attachTransportHandlers(connectionId, connectionInfo, state);

    // emit the connection event to notify listeners of the new connection
    this.emit("connection", { connectionId, connectionInfo });
  };

  /**
   * Attaches event handlers to the transport of a connection.
   * @param connectionId The ID of the connection.
   * @param connectionInfo The information about the connection.
   * @param connection The state of the connection.
   */
  private attachTransportHandlers(
    connectionId: number,
    connectionInfo: string,
    connection: ConnectionState
  ): void {
    const { transport } = connection;

    transport.packetReceivedHandler = (packet) => {
      void this.handlePacket(packet, connectionId).catch((error: unknown) => {
        // catch error during packet handling and disconnect the connection
        const cause = error instanceof Error ? error : new Error(String(error));

        return this.disconnectConnection(connectionId, connection, cause);
      });
    };

    transport.disconnectHandler = (error) => {
      // ignore repeated disconnects
      if (!this.connections.delete(connectionId)) return;

      // stop the Keep Alive timeout for the connection
      clearTimeout(connection.keepAliveTimeout);

      // skip if there is no active session for this client
      if (connection.clientId) {
        const session = this.sessions.get(connection.clientId);

        // ensure it is actual session
        if (session?.activeConnection === connection) {
          // if session is permanent, clear the active connection
          if (session.isPermanent) {
            session.activeConnection = undefined;
          } else {
            // if session is not permanent, delete entire session
            this.sessions.delete(connection.clientId);
          }
        }
      }

      // emit the connectionClosed event with the reason and optional error
      this.emit(
        "connectionClosed",
        error
          ? { connectionId, connectionInfo, reason: "transport-error", error } // with error
          : {
              connectionId,
              connectionInfo,
              reason: connection.stopping ? "broker-stop" : "transport-closed",
            } // without error
      );
    };
  }

  //
  // PACKET HANDLING
  //

  private async handlePacket(
    packet: AnyPacketV4,
    connectionId: number
  ): Promise<void> {
    const connection = this.connections.get(connectionId);

    if (!connection) return; // ignore packets for unknown connections

    // ignore packets for connections that are closing
    if (connection.phase === "closing") return;

    if (
      // CONNECT packet must be the first packet for a new connection
      (connection.phase === "beforeConnect" &&
        packet.typeId !== PacketType.CONNECT) ||
      // CONNECT packet must be sent only once for a new connection
      (connection.phase !== "beforeConnect" &&
        packet.typeId === PacketType.CONNECT)
    ) {
      // close the connection without sending a response due to protocol violation
      await this.disconnectConnection(connectionId, connection);
      return;
    }

    switch (packet.typeId) {
      case PacketType.CONNECT:
        await this.handleConnectPacket(packet, connectionId, connection);
        break;
      case PacketType.PINGREQ:
        const pingresp = MqttPacketV4Factory.createSimplePacketV4(
          PacketType.PINGRESP
        );
        this.resetKeepAliveTimeout(connectionId, connection);
        await connection.transport.send(pingresp);
        break;
      case PacketType.DISCONNECT:
        this.disconnectConnection(connectionId, connection);
        break;
      // TODO: other packet types handling1
      default:
        throw Error("Unhandled packet type");
    }
  }

  /**
   * Handles an incoming CONNECT packet from a client.
   * @param packet The CONNECT packet received from the client.
   * @param connection The state of the connection from which the packet was received.
   */
  private async handleConnectPacket(
    packet: ConnectPacketV4,
    connectionId: number,
    connection: ConnectionState
  ): Promise<void> {
    const returnCode = this.getConnectReturnCode(packet);
    const isConnectionAccepted =
      returnCode === ConnackReturnCodeV4.CONNECTION_ACCEPTED;

    connection.phase = isConnectionAccepted ? "connected" : "closing";

    const clientId = packet.payload.clientIdentifier;
    let sessionPresent = false;

    if (isConnectionAccepted) {
      let session = this.sessions.get(clientId);

      // close any existing active connection for this session
      while (session?.activeConnection) {
        const previousConnection = session.activeConnection;
        previousConnection.phase = "closing";
        await previousConnection.transport.disconnect();

        if (
          !this.connections.has(connectionId) ||
          connection.phase !== "connected"
        )
          return;

        // closing the old transport can remove its clean session
        session = this.sessions.get(clientId);
      }

      sessionPresent = this.updateSession(
        clientId,
        connectionId,
        connection,
        packet.flags.cleanSession,
        packet.keepAlive
      );
    }

    // create the CONNACK response packet and send it to the client
    const response: ConnackPacketV4 = MqttPacketV4Factory.createConnackPacketV4(
      sessionPresent,
      returnCode
    );

    // send the CONNACK response to the client
    await connection.transport.send(response);

    // if connection is not accepted, disconnect the transport
    if (!isConnectionAccepted) {
      await this.disconnectConnection(connectionId, connection);
    } else if (
      this.connections.has(connectionId) &&
      connection.phase === "connected"
    ) {
      // initialize the Keep Alive timeout for the connection
      this.resetKeepAliveTimeout(connectionId, connection);

      // emit the clientConnected event
      this.emit("clientConnected", {
        clientId,
        connectionId,
      });
    }
  }

  /**
   * Determines the CONNACK return code for the given CONNECT packet.
   * @param packet The CONNECT packet received from the client.
   * @returns The appropriate CONNACK return code based on the CONNECT packet.
   */
  private getConnectReturnCode(packet: ConnectPacketV4): ConnackReturnCodeV4 {
    if (!isBasicClientId(packet.payload.clientIdentifier)) {
      return ConnackReturnCodeV4.CONNECTION_REFUSED_IDENTIFIER_REJECTED;
    }

    const auth: MqttAuth | undefined = packet.flags.userName
      ? {
          user: packet.payload.userName!, // Required when the User Name flag is set.
          password: packet.payload.password,
        }
      : undefined;

    return this.auth.canLogin(auth)
      ? ConnackReturnCodeV4.CONNECTION_ACCEPTED
      : ConnackReturnCodeV4.CONNECTION_REFUSED_NOT_AUTHORIZED;
  }

  /**
   * Updates the session for the given client ID and connection.
   * @param clientId The client ID for which the session is being updated.
   * @param connection The connection associated with the session.
   * @param cleanSession Indicates whether the session should be cleaned.
   * @returns A boolean indicating whether the session was present before the update.
   */
  private updateSession(
    clientId: string,
    connectionId: number,
    connection: ConnectionState,
    cleanSession: boolean,
    keepAliveSeconds: number
  ): boolean {
    const session = this.sessions.get(clientId);

    if (!cleanSession && session) {
      session.activeConnection = connection;
    } else {
      // if session does not exist, create a new one
      const session = {
        activeConnection: connection,
        isPermanent: !cleanSession,
      };

      this.sessions.set(clientId, session);
    }
    connection.clientId = clientId;
    connection.keepAliveSeconds = keepAliveSeconds;

    const sessionPresent = !cleanSession && session !== undefined;

    return sessionPresent;
  }

  /**
   * Resets the keep-alive timeout for the given connection.
   * @param connectionId The ID of the connection for which the keep-alive timeout is being reset.
   * @param connection The connection object whose keep-alive timeout is being reset.
   */
  private resetKeepAliveTimeout(
    connectionId: number,
    connection: ConnectionState
  ): void {
    // clear existing keep-alive timeout if any
    clearTimeout(connection.keepAliveTimeout);

    const keepAlive = connection.keepAliveSeconds;
    if (!keepAlive) return;

    connection.keepAliveTimeout = setTimeout(() => {
      // when the keep-alive timeout expires, disconnect the connection due to inactivity
      void this.disconnectConnection(
        connectionId,
        connection,
        new Error("Keep Alive timeout")
      );
    }, keepAlive * 1_500); // from the MQTT 3.1.1 specification
  }

  private async disconnectConnection(
    connectionId: number,
    connection: ConnectionState,
    error?: Error
  ): Promise<void> {
    if (!this.connections.has(connectionId)) return;

    connection.phase = "closing";

    try {
      if (error) await connection.transport.disconnect(error);
      else await connection.transport.disconnect();
    } catch (error) {
      this.emit("brokerError", {
        source: "connection-transport",
        connectionId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}
