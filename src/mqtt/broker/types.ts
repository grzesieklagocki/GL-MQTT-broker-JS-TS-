import { AnyPacketV4 } from "../protocol/v4/types";
import { IMqttSocketTransportAdapter } from "../shared/types";

type ConnectionEvent = { connectionId: number; connectionInfo: string };

export type MqttBrokerEvents = {
  connection: [event: ConnectionEvent];
  connectionClosed: [
    event: ConnectionEvent &
      (
        | { reason: "transport-closed" }
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
   * Stops listening for incoming connections.
   */
  stop(): void;

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
