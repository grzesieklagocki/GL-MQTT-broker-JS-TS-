import { EventEmitter } from "node:events";
import {
  AcceptedConnection,
  ConnectionState,
  IAuthManager,
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
   * @param state The state of the connection.
   */
  private attachTransportHandlers(
    connectionId: number,
    connectionInfo: string,
    state: ConnectionState
  ): void {
    const { transport } = state;

    transport.packetReceivedHandler = (packet) => {
      void this.handlePacket(packet, connectionId).catch((error: unknown) => {
        // catch error during packet handling and disconnect the connection
        const cause = error instanceof Error ? error : new Error(String(error));

        return this.disconnectConnection(connectionId, state, cause);
      });
    };

    transport.disconnectHandler = (error) => {
      // ignore repeated disconnects
      if (!this.connections.delete(connectionId)) return;

      // emit the connectionClosed event with the reason and optional error
      this.emit(
        "connectionClosed",
        error
          ? { connectionId, connectionInfo, reason: "transport-error", error } // with error
          : {
              connectionId,
              connectionInfo,
              reason: state.stopping ? "broker-stop" : "transport-closed",
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

    if (packet.typeId === PacketType.CONNECT) {
      await this.handleConnectPacket(packet, connectionId, connection);
    }
    // TODO: other packet types handling1
    else throw Error("Unhandled packet type");
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
    const hasCredentials = packet.flags.userName; // if the username flag is set, the client has provided credentials
    const auth: MqttAuth | undefined = hasCredentials
      ? {
          user: packet.payload.userName!, // if username flag is set, user must be present
          password: packet.payload.password,
        }
      : undefined; // when no credentials provided

    // check if the client id is valid
    const hasValidClientId = isBasicClientId(packet.payload.clientIdentifier);

    const canLogin =
      hasValidClientId &&
      // ask the authentication service if the client can login
      this.auth.canLogin(auth);

    const sessionPresent = false; // TODO: determine if a session is already present for this client
    const returnCode = canLogin
      ? ConnackReturnCodeV4.CONNECTION_ACCEPTED
      : hasValidClientId
        ? ConnackReturnCodeV4.CONNECTION_REFUSED_NOT_AUTHORIZED
        : ConnackReturnCodeV4.CONNECTION_REFUSED_IDENTIFIER_REJECTED;

    const isConnectionAccepted =
      returnCode === ConnackReturnCodeV4.CONNECTION_ACCEPTED;

    connection.phase = isConnectionAccepted ? "connected" : "closing";

    // create the CONNACK response packet and send it to the client
    const response: ConnackPacketV4 = MqttPacketV4Factory.createConnackPacketV4(
      sessionPresent,
      returnCode
    );

    await connection.transport.send(response);

    // if connection is not accepted, disconnect the transport
    if (!isConnectionAccepted) {
      await this.disconnectConnection(connectionId, connection);
    }
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
