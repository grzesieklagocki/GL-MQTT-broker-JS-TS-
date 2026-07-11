import { AnyPacket } from "@mqtt/protocol/shared/types";
import { EventEmitter } from "node:events";

/**
 * Interface for a transport adapter that handles MQTT packets of a specific type.
 */
export interface ITransportAdapter<
  PacketType extends AnyPacket,
> extends EventEmitter /* for emitting events like "dataReceived" */ {
  /**
   * Sends a packet to the transport layer.
   * @param packet - The MQTT packet to be sent.
   */
  send(packet: PacketType): void;
  disconnect(): void;
}

/**
 * Enum representing the connection status of an MQTT client.
 */
export enum ConnectionStatus {
  DISCONNECTED, // The client is not connected to the broker.
  CONNECTING, // The client is in the process of establishing a connection to the broker.
  CONNECTED, // The client is successfully connected to the broker.
}
