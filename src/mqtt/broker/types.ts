import { QoS } from "../protocol/shared/types";
import { AnyPacketV4, PublishPacketV4 } from "../protocol/v4/types";
import {
  IMqttSocketTransportAdapter,
  IPacketIdentifierManager,
  MqttAuth,
} from "../shared/types";

type ConnectionEvent = { connectionId: number; connectionInfo: string };

export type MqttBrokerEvents = {
  connection: [event: ConnectionEvent];
  connectionClosed: [
    event: ConnectionEvent &
      (
        | { reason: "transport-closed" | "broker-stop" }
        | { reason: "transport-error"; error: Error }
      ),
  ];
  clientConnected: [event: { connectionId: number; clientId: string }];
  brokerError: [
    event:
      | { source: "network-listener"; error: Error }
      | { source: "connection-transport"; connectionId: number; error: Error },
  ];
};

/** A transport accepted by a listener, with its diagnostic description. */
export type AcceptedConnection = {
  transport: IMqttSocketTransportAdapter<AnyPacketV4>;
  info: string;
};

/**
 * Listens for incoming connections and passes them to the broker.
 */
export interface IConnectionListener {
  /**
   * Starts listening for incoming connections.
   */
  listen(): void;

  /**
   * Stops reporting new connections immediately and resolves once closed.
   * The listener closes any connections it has not passed to the broker.
   * The returned promise may also wait for broker-owned transports to close.
   */
  stop(): Promise<void>;

  /**
   * Handler for new connections. This function is called when a new connection is established.
   * @param connection - The connection object representing the new connection.
   */
  connectionHandler: (connection: AcceptedConnection) => void;

  /**
   * Handler called when the connection listener closes.
   * @param error - An optional error that caused the listener to close.
   */
  closeHandler: (error?: Error) => void;
}

/**
 * Manages authentication for MQTT clients.
 */
export interface IAuthManager {
  /**
   * Determines if the provided authentication credentials are valid for login.
   * @param auth The authentication credentials to check.
   * @returns `true` if the credentials are valid, `false` otherwise.
   */
  canLogin(auth?: MqttAuth): boolean;

  canSubscribe(topicFilter: string): QoS | false;

  //TODO: canPublish
}

/**
 * Represents the phase of a connection
 */
export type ConnectionPhase = "beforeConnect" | "connected" | "closing";

/**
 * Represents the state of a connection, including its transport, stopping status, and phase.
 */
export type ConnectionState = {
  readonly connectionId: number; // the unique identifier for the connection (read-only)

  transport: AcceptedConnection["transport"]; // transport adapter for the connection
  stopping: boolean; // indicates if the connection is in the process of stopping
  phase: ConnectionPhase; // current phase of the connection (beforeConnect, connected, or closing)

  clientId?: string; // the client identifier associated with the connection (optional, set after CONNECT)
  keepAliveSeconds?: number; // the keep-alive interval for the client session (optional)
  keepAliveTimeout?: NodeJS.Timeout; // the timeout for the keep-alive mechanism (optional)
};

/**
 * Represents the delivery status of a PUBLISH packet.
 */
export type DeliveryStatus = "notSent" | "awaitingPuback";

export type ClientSession = {
  isPermanent: boolean; // indicates if the client session has to be stored after disconnection (true) or can be discarded (false)
  activeConnection?: ConnectionState; // the currently active connection for the client session (optional)

  packetIdManager: IPacketIdentifierManager; // manages packet identifiers for the connection

  readonly incomingQos2PacketIds: Set<number>; // set of packet identifiers for incoming QoS 2 PUBLISH packets awaiting PUBREL
  readonly outgoingPublishPackets: Map<
    number,
    { packet: PublishPacketV4; status: DeliveryStatus }
  >; // map of packet identifiers to pending PUBLISH packets
};
