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
  PubackPacketV4,
  PubcompPacketV4,
  PublishPacketV4,
  PubrecPacketV4,
  PubrelPacketV4,
  SubackReturnCodeV4,
  SubscribePacketV4,
  UnsubscribePacketV4,
} from "../protocol/v4/types";
import { PacketType, QoS } from "../protocol/shared/types";
import { MqttAuth } from "../shared/types";
import { MqttPacketV4Factory } from "../protocol/v4/MqttPacketV4Factory";
import { isBasicClientId } from "../protocol/v4/validation/connect";
import {
  IRetainedMessagesManager,
  ISubscriptionManager,
  RetainedMessage,
} from "./topics/types";
import { SubscriptionManager } from "./topics/SubscriptionManager";
import { RetainedMessagesManager } from "./topics/RetainedMessagesManager";
import { PacketIdentifierManager } from "../shared/PacketIdentifierManager";

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
  constructor(
    private readonly auth: IAuthManager,
    private readonly subscriptions: ISubscriptionManager = new SubscriptionManager(),
    private readonly retainedMessages: IRetainedMessagesManager = new RetainedMessagesManager()
  ) {
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
      connectionId,
      transport,
      stopping: false,
      phase: "beforeConnect",
    };

    // store the connection state in the connections map
    this.connections.set(connectionId, state);

    // attach event handlers to the transport of the connection
    this.attachTransportHandlers(connectionInfo, state);

    // emit the connection event to notify listeners of the new connection
    this.emit("connection", { connectionId, connectionInfo });
  };

  /**
   * Attaches event handlers to the transport of a connection.
   * @param connectionInfo The information about the connection.
   * @param connection The state of the connection.
   */
  private attachTransportHandlers(
    connectionInfo: string,
    connection: ConnectionState
  ): void {
    const { transport } = connection;
    const connectionId = connection.connectionId;

    // no queue until CONNECT handling starts
    let pendingPackets: AnyPacketV4[] | undefined;

    const handleIncomingPacket = async (packet: AnyPacketV4): Promise<void> => {
      if (
        connection.phase !== "beforeConnect" ||
        packet.typeId !== PacketType.CONNECT
      ) {
        return this.handlePacket(packet, connectionId);
      }

      // start buffering before waiting for CONNECT to finish
      const queue: AnyPacketV4[] = [];

      pendingPackets = queue;

      try {
        await this.handlePacket(packet, connectionId);
        // handle queued packets in order after CONNACK
        for (const pendingPacket of queue) {
          await this.handlePacket(pendingPacket, connectionId);
        }
      } finally {
        // stop buffering even if packet handling fails
        pendingPackets = undefined;
      }
    };

    transport.packetReceivedHandler = (packet) => {
      if (connection.phase === "closing") return;

      // add new packets to the end while the queue is active
      if (pendingPackets) {
        pendingPackets.push(packet);
        return;
      }

      void handleIncomingPacket(packet).catch((error: unknown) => {
        // catch error during packet handling and disconnect the connection
        const cause = error instanceof Error ? error : new Error(String(error));

        return this.disconnectConnection(connection, cause);
      });
    };

    transport.disconnectHandler = (error) => {
      // ignore repeated disconnects
      if (!this.connections.delete(connectionId)) return;

      // drop any packets still waiting when the transport closes
      if (pendingPackets) pendingPackets.length = 0;

      // stop the Keep Alive timeout for the connection
      clearTimeout(connection.keepAliveTimeout);

      const clientId = connection.clientId;

      // skip if there is no active session for this client
      if (clientId) {
        const session = this.getSession(connection);

        // ensure it is actual session
        if (session?.activeConnection === connection) {
          // if session is permanent, clear the active connection
          if (session.isPermanent) {
            session.activeConnection = undefined;
          } else {
            // if session is not permanent, delete entire session
            this.subscriptions.unsubscribe(clientId);
            this.sessions.delete(clientId);
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
      await this.disconnectConnection(connection);
      return;
    }

    // reset the keep-alive timeout for connected clients
    if (connection.phase === "connected") {
      this.resetKeepAliveTimeout(connection);
    }

    switch (packet.typeId) {
      case PacketType.CONNECT:
        await this.handleConnectPacket(packet, connection);
        break;

      case PacketType.PUBLISH:
        await this.handlePublishPacket(packet, connection);
        break;

      case PacketType.PUBACK:
        await this.handlePubackPacket(packet, connection);
        break;

      case PacketType.PUBREC:
        this.handlePubrecPacket(packet, connection);
        break;

      case PacketType.PUBREL:
        await this.handlePubrelPacket(packet, connection);
        break;

      case PacketType.PUBCOMP:
        await this.handlePubcompPacket(packet, connection);
        break;

      case PacketType.SUBSCRIBE:
        await this.handleSubscribePacket(packet, connection);
        break;

      case PacketType.UNSUBSCRIBE:
        await this.handleUnsubscribePacket(packet, connection);
        break;

      case PacketType.PINGREQ:
        // send back a PINGRESP packet to the client
        const pingresp = MqttPacketV4Factory.createSimplePacketV4(
          PacketType.PINGRESP
        );
        await this.trySend(connection, pingresp);
        break;

      case PacketType.DISCONNECT:
        this.disconnectConnection(connection);
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
    connection: ConnectionState
  ): Promise<void> {
    const returnCode = this.getConnectReturnCode(packet);
    const isConnectionAccepted =
      returnCode === ConnackReturnCodeV4.CONNECTION_ACCEPTED;

    connection.phase = isConnectionAccepted ? "connected" : "closing";

    const clientId = packet.payload.clientIdentifier;
    const connectionId = connection.connectionId;
    let session = this.sessions.get(clientId);
    let sessionPresent = false;

    if (isConnectionAccepted) {
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
    if (!(await this.trySend(connection, response))) return;

    // if connection is not accepted, disconnect the transport
    if (!isConnectionAccepted) {
      await this.disconnectConnection(connection);
    } else if (
      this.connections.has(connectionId) &&
      connection.phase === "connected"
    ) {
      // initialize the Keep Alive timeout for the connection
      this.resetKeepAliveTimeout(connection);

      //
      // RESEND PENDING PACKETS
      //

      // resend pending PUBLISH packets (from previous sessions or not yet confirmed)
      if (sessionPresent && session?.outgoingPublishPackets) {
        for (const pending of session.outgoingPublishPackets.values()) {
          let packet;

          switch (pending.status) {
            case "notSent":
              // use the original packet for notSent status
              packet = pending.packet;
              break;

            case "awaitingPubrec":
            case "awaitingPuback":
              // set DUP flag for retransmitted PUBLISH packets with awaitingPuback status
              const setDup = (packet: PublishPacketV4) => {
                return {
                  ...packet,
                  flags: { ...packet.flags, dup: true },
                };
              };
              packet = setDup(pending.packet);
              break;

            case "awaitingPubcomp":
              // create PUBREL packet for retransmission of QoS 2 PUBLISH packets awaiting PUBCOMP
              packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
                PacketType.PUBREL,
                pending.packet.identifier!
              );
              break;
          }

          const isMessageSent = await this.trySend(connection, packet);

          // update the status of the pending packet if it was successfully sent and was notSent before
          if (isMessageSent && pending.status === "notSent")
            pending.status = "awaitingPubrec";
        }
      }

      // emit the clientConnected event
      this.emit("clientConnected", {
        clientId,
        connectionId,
      });
    }
  }

  /**
   * Handles an incoming PUBLISH packet from a client and forwards it to the appropriate subscribers.
   * @param packet The PUBLISH packet received from the client.
   */
  private async handlePublishPacket(
    packet: PublishPacketV4,
    connection: ConnectionState
  ) {
    const topic = packet.topicName;
    const message = packet.applicationMessage;
    const qos = packet.flags.qosLevel;

    //
    // MANAGE QoS FOR INCOMING PUBLISH PACKETS
    //

    if (qos > 0) {
      if (packet.identifier === undefined)
        throw Error("Packet identifier is required for QoS > 0"); // should never happen, parser validates that QoS > 0 packets have an identifier

      const session = this.getSession(connection);
      if (!session) return;

      // send PUBACK to the publisher if the QoS level is 1
      // or PUBREC if the QoS level is 2
      const response = MqttPacketV4Factory.createPacketWithIdentifierV4(
        qos === 1 ? PacketType.PUBACK : PacketType.PUBREC,
        packet.identifier
      );

      const isPubrecDuplicate =
        qos === 2 && session.incomingQos2PacketIds.has(packet.identifier);

      if (qos === 2 && !isPubrecDuplicate) {
        // store the packet identifier to track incoming QoS 2 packets
        session.incomingQos2PacketIds.add(packet.identifier);
      }

      // send response (PUBACK for QoS 1 or PUBREC for QoS 2) to the publisher
      await this.trySend(connection, response);

      // skip processing the message if it is a duplicate QoS 2 packet
      if (isPubrecDuplicate) return;
    }

    //
    // SEND TO SUBSCRIBERS
    //

    // get the list of subscribers for the topic
    const subscribers = this.subscriptions.getSubscribers(topic);

    // for each subscriber, determine if the message can be sent immediately or needs to be queued for later delivery
    for (const subscriber of subscribers) {
      const clientSession = this.sessions.get(subscriber.clientId);

      if (!clientSession) continue;

      const clientConnection = clientSession.activeConnection;
      const canSend = clientConnection?.phase === "connected";
      const grantedQos = Math.min(qos, subscriber.qos) as QoS; // calculate the granted QoS for this subscriber (according to MQTT specification)

      // create the PUBLISH packet for this subscriber
      const publishPacket = MqttPacketV4Factory.createPublishPacketV4(
        topic,
        message,
        MqttPacketV4Factory.createPublishFlagsV4(grantedQos) // flags
      );

      if (grantedQos > 0) {
        // if the granted QoS for this subscriber is 1 or 2
        // allocate a packet identifier and track it for PUBACK or PUBREC
        publishPacket.identifier =
          clientSession.packetIdManager.allocateIdentifier();
        clientSession.outgoingPublishPackets.set(publishPacket.identifier, {
          packet: publishPacket,
          status: "notSent",
        });
      }

      if (canSend) {
        let pending;

        // store pending packet for QoS 2 to track its status
        if (qos === 2)
          pending = clientSession.outgoingPublishPackets.get(
            publishPacket.identifier! // non-null assertion because identifier is allocated for QoS 1 or 2
          );

        // send the PUBLISH packet to the subscriber
        const isMessageSent = await this.trySend(
          clientConnection,
          publishPacket
        );

        // set the status to "awaitingPubrec" if the message was sent and the granted QoS is 2
        if (grantedQos === 2 && isMessageSent) {
          // if status is still "notSent", update it to "awaitingPubrec"
          if (pending?.status === "notSent") pending!.status = "awaitingPubrec";
        }
      }
    }

    //
    // STORE RETAINED MESSAGE
    //

    // if the retain flag is set, store the message as a retained message
    if (packet.flags.retain) {
      this.retainedMessages.set(topic, message ?? new Uint8Array(), qos);
    }
  }

  private async handlePubackPacket(
    packet: PubackPacketV4,
    connection: ConnectionState
  ) {
    const session = this.getSession(connection);
    if (!session) return;

    // ignore PUBACK packets that are not expected and not in the "awaitingPuback" state
    if (
      session.outgoingPublishPackets.get(packet.identifier)?.status !==
      "awaitingPuback"
    )
      return;

    session.packetIdManager.releaseIdentifier(packet.identifier);
    session.outgoingPublishPackets.delete(packet.identifier);
  }

  private async handlePubrecPacket(
    packet: PubrecPacketV4,
    connection: ConnectionState
  ) {
    const session = this.getSession(connection);
    if (!session) return;

    const pending = session.outgoingPublishPackets.get(packet.identifier);
    if (!pending || pending.status === "awaitingPuback") return;

    pending.status = "awaitingPubcomp";

    const pubrel = MqttPacketV4Factory.createPacketWithIdentifierV4(
      PacketType.PUBREL,
      packet.identifier
    );

    await this.trySend(connection, pubrel);
  }

  private async handlePubrelPacket(
    packet: PubrelPacketV4,
    connection: ConnectionState
  ) {
    const session = this.getSession(connection);
    if (!session) return;

    const pubcomp = MqttPacketV4Factory.createPacketWithIdentifierV4(
      PacketType.PUBCOMP,
      packet.identifier
    );

    session.incomingQos2PacketIds.delete(packet.identifier);

    await this.trySend(connection, pubcomp);
  }

  private async handlePubcompPacket(
    packet: PubcompPacketV4,
    connection: ConnectionState
  ) {
    const session = this.getSession(connection);
    const status = session?.outgoingPublishPackets.get(
      packet.identifier
    )?.status;

    if (status !== "awaitingPubcomp") return;

    // remove the outgoing PUBLISH packet and release its identifier from the packet ID manager
    session?.outgoingPublishPackets.delete(packet.identifier);
    session?.packetIdManager.releaseIdentifier(packet.identifier);
  }

  /**
   * Handles an incoming SUBSCRIBE packet from a client and sends the appropriate SUBACK response.
   * @param packet The SUBSCRIBE packet received from the client.
   * @param connection The connection state of the client that sent the SUBSCRIBE packet.
   */
  private async handleSubscribePacket(
    packet: SubscribePacketV4,
    connection: ConnectionState
  ) {
    const returnCodeList: SubackReturnCodeV4[] = packet.subscriptionList.map(
      (subscription) => {
        const topicFilter = subscription[0];
        const requestedQos = subscription[1];

        const maxAllowedQos = this.auth.canSubscribe(topicFilter);

        if (maxAllowedQos !== false) {
          const grantedQos = Math.min(requestedQos, maxAllowedQos) as QoS;

          this.subscriptions.subscribe(
            connection.clientId!,
            topicFilter,
            grantedQos
          );

          // send retained messages for the topic filter to the subscribing client
          const retainedMessages = this.retainedMessages.get(topicFilter);

          retainedMessages.forEach(
            (m) => (m.qos = Math.min(m.qos, grantedQos) as QoS)
          ); // limit retained message QoS

          this.publishRetainedMessages(retainedMessages, connection);

          return grantedQos;
        } else return SubackReturnCodeV4.FAILURE;
      }
    );

    const suback = MqttPacketV4Factory.createSubackPacketV4(
      packet.identifier,
      returnCodeList
    );

    // send the SUBACK packet to the client
    await this.trySend(connection, suback);
  }

  private async handleUnsubscribePacket(
    packet: UnsubscribePacketV4,
    connection: ConnectionState
  ) {
    // skip if connection or clientId is not set
    if (!connection || !connection.clientId) return;

    const unsuback = MqttPacketV4Factory.createPacketWithIdentifierV4(
      PacketType.UNSUBACK,
      packet.identifier
    );

    // unsubscribe from all topic filters in the UNSUBSCRIBE packet
    for (const topicFilter of packet.topicFilterList) {
      this.subscriptions.unsubscribe(connection.clientId, topicFilter);
    }

    // send the UNSUBACK packet to the client
    await this.trySend(connection, unsuback);
  }

  private async trySend(
    connection: ConnectionState,
    packet: AnyPacketV4
  ): Promise<boolean> {
    try {
      const identifier =
        packet.typeId === PacketType.PUBLISH && packet.flags.qosLevel === 1
          ? packet.identifier
          : undefined;
      const pending =
        identifier !== undefined
          ? this.getSession(connection)?.outgoingPublishPackets.get(identifier)
          : undefined;

      // send the packet to the client
      await connection.transport.send(packet);

      // new session or delivery can reuse the identifier while send is pending
      if (
        pending &&
        identifier !== undefined &&
        this.getSession(connection)?.outgoingPublishPackets.get(identifier) ===
          pending
      ) {
        // update pending status
        pending.status = "awaitingPuback"; // for QoS 1 PUBLISH packets
      }

      return true;
    } catch (error) {
      void this.disconnectConnection(
        connection,
        error instanceof Error ? error : new Error(String(error))
      );

      return false;
    }
  }

  private publishRetainedMessages(
    messages: RetainedMessage[],
    connection: ConnectionState
  ) {
    const session = this.getSession(connection);
    if (!session) return;

    for (const message of messages) {
      const flags = MqttPacketV4Factory.createPublishFlagsV4(
        message.qos,
        true // retain flag set
      );

      const identifier =
        message.qos > 0
          ? session.packetIdManager.allocateIdentifier()
          : undefined;
      const publishPacket = MqttPacketV4Factory.createPublishPacketV4(
        message.topic,
        message.payload,
        flags,
        identifier
      );

      // register the expected PUBACK ID for the session if QoS is 1
      if (message.qos === 1 && identifier !== undefined) {
        session.outgoingPublishPackets.set(identifier, {
          packet: publishPacket,
          status: "notSent",
        });
      }

      this.trySend(connection, publishPacket);
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

  private getSession = (
    connection: ConnectionState
  ): ClientSession | undefined =>
    connection.clientId ? this.sessions.get(connection.clientId) : undefined;

  /**
   * Updates the session for the given client ID and connection.
   * @param clientId The client ID for which the session is being updated.
   * @param connection The connection associated with the session.
   * @param cleanSession Indicates whether the session should be cleaned.
   * @returns A boolean indicating whether the session was present before the update.
   */
  private updateSession(
    clientId: string,
    connection: ConnectionState,
    cleanSession: boolean,
    keepAliveSeconds: number
  ): boolean {
    const session = this.sessions.get(clientId);

    if (!cleanSession && session) {
      session.activeConnection = connection;
    } else {
      // if session does not exist, create a new one
      const session: ClientSession = {
        activeConnection: connection,
        isPermanent: !cleanSession,
        packetIdManager: new PacketIdentifierManager(), // initialize a new packet identifier manager for the session
        outgoingPublishPackets: new Map(),
        incomingQos2PacketIds: new Set(),
      };

      // set the new session for the client ID and unsubscribe from all previous subscriptions
      this.sessions.set(clientId, session);
      this.subscriptions.unsubscribe(clientId);
    }
    connection.clientId = clientId;
    connection.keepAliveSeconds = keepAliveSeconds;

    const sessionPresent = !cleanSession && session !== undefined;

    return sessionPresent;
  }

  /**
   * Resets the keep-alive timeout for the given connection.
   * @param connection The connection object whose keep-alive timeout is being reset.
   */
  private resetKeepAliveTimeout(connection: ConnectionState): void {
    // clear existing keep-alive timeout if any
    clearTimeout(connection.keepAliveTimeout);

    const keepAlive = connection.keepAliveSeconds;
    if (!keepAlive) return;

    connection.keepAliveTimeout = setTimeout(() => {
      // when the keep-alive timeout expires, disconnect the connection due to inactivity
      void this.disconnectConnection(
        connection,
        new Error("Keep Alive timeout")
      );
    }, keepAlive * 1_500); // from the MQTT 3.1.1 specification
  }

  private async disconnectConnection(
    connection: ConnectionState,
    error?: Error
  ): Promise<void> {
    if (!this.connections.has(connection.connectionId)) return;

    connection.phase = "closing";

    try {
      if (error) await connection.transport.disconnect(error);
      else await connection.transport.disconnect();
    } catch (error) {
      this.emit("brokerError", {
        source: "connection-transport",
        connectionId: connection.connectionId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}
