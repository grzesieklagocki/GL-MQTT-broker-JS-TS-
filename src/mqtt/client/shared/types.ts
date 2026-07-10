import { AnyPacket } from "@mqtt/protocol/shared/types";
import { EventEmitter } from "stream";

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
}
