import { EventEmitter } from "node:events";
import {
  AcceptedConnection,
  IConnectionListener,
  MqttBrokerEvents,
} from "./types";

export class MqttBroker extends EventEmitter<MqttBrokerEvents> {
  private nextConnectionId = 1; // for generating unique connection IDs

  private readonly connectionListeners = new Set<IConnectionListener>();
  private readonly connections = new Map<number, AcceptedConnection>();

  /**
   * Adds a new connection listener to the broker.
   * @param listener The connection listener to add to the broker.
   */
  public addConnectionListener(listener: IConnectionListener): void {
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

  private handleNewConnection = (connection: AcceptedConnection) => {
    const { transport, info: connectionInfo } = connection;
    const connectionId = this.nextConnectionId++;
    this.connections.set(connectionId, connection);

    // TODO: handle incoming packets from the transport
    transport.packetReceivedHandler = () => {};
    transport.disconnectHandler = (error) => {
      // ignore repeated disconnects
      if (!this.connections.delete(connectionId)) return;

      // emit the connectionClosed event with the reason and optional error
      this.emit(
        "connectionClosed",
        error
          ? { connectionId, connectionInfo, reason: "transport-error", error }
          : { connectionId, connectionInfo, reason: "transport-closed" }
      );
    };

    // emit the connection event to notify listeners of the new connection
    this.emit("connection", { connectionId, connectionInfo });
  };
}
