import { AnyPacketV4 } from "../protocol/v4/types";
import { IMqttSocketTransportAdapter, MqttAuth } from "../shared/types";

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
  brokerError: [event: { source: "network-listener"; error: Error }];
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

  //TODO: canSubscribe, canPublish
}

/**
 * Represents the phase of a connection
 */
export type ConnectionPhase = "beforeConnect" | "connected" | "closing";

/**
 * Represents the state of a connection, including its transport, stopping status, and phase.
 */
export type ConnectionState = {
  transport: AcceptedConnection["transport"];
  stopping: boolean;
  phase: ConnectionPhase;
};
