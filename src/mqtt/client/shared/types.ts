import { AnyPacket } from "@mqtt/protocol/shared/types";
import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { EventEmitter } from "node:events";

type IMqttTransportAdapterEvents = {
  packetReceived: (packet: AnyPacketV4) => void;
  disconnect: (error?: Error) => void;
  connect: () => void;
};

/**
 * Interface for a transport adapter that handles MQTT packets of a specific type.
 */
export interface IMqttTransportAdapter<
  PacketType extends AnyPacket,
> extends EventEmitter /* for emitting events: connected, disconnected, packetReceived */ {
  /**
   * Connects to the transport layer (e.g. TCP) and will emit the "connected" event.
   */
  connect(): void;

  /**
   * Sends a packet to the transport layer.
   * @param packet - The MQTT packet to be sent.
   */
  send(packet: PacketType): void;

  /**
   * Disconnects the transport layer (e.g. TCP) and will emit the "disconnected" event with provided (optional) error.
   * @param error - Optional error that caused the disconnect.
   */
  disconnect(error?: Error): void;

  /**
   * Registers an event listener for a specific event emitted by the transport adapter.
   * @param eventName - The name of the event to listen for.
   * @param listener - The callback function to be invoked when the event occurs.
   */
  on<EventName extends keyof IMqttTransportAdapterEvents>(
    eventName: EventName,
    listener: IMqttTransportAdapterEvents[EventName]
  ): this;
}

/**
 * Enum representing the connection status of an MQTT client.
 */
export enum ConnectionStatus {
  DISCONNECTED, // The client is not connected to the broker.
  CONNECTING, // The client is in the process of establishing a connection to the broker.
  CONNECTED, // The client is successfully connected to the broker.
}
