import { AnyPacket } from "@mqtt/protocol/shared/types";

/**
 * Interface for a transport adapter that handles MQTT packets of a specific type.
 */
export interface IMqttTransportAdapter<
  PacketType extends AnyPacket,
> /* for emitting events: connected, disconnected, packetReceived */ {
  /**
   * Connects to the transport layer (e.g. TCP) and will emit the "connected" event.
   */
  connect(): Promise<void>;

  /**
   * Sends a packet to the transport layer.
   * @param packet - The MQTT packet to be sent.
   */
  send(packet: PacketType): Promise<void>;

  /**
   * Disconnects the transport layer (e.g. TCP) and will emit the "disconnected" event with provided (optional) error.
   * @param error - Optional error that caused the disconnect.
   */
  disconnect(error?: Error): void;

  /**
   * Callback function to be invoked when a packet is received from the transport layer.
   * @param packet - The MQTT packet that was received.
   * @returns True if the packet was handled successfully, or an Error if there was an issue processing the packet.
   */
  onPacketReceived: (packet: PacketType) => true | Error;

  /**
   * Callback function to be invoked when the transport layer is disconnected.
   * @param error - Optional error that caused the disconnect.
   */
  onDisconnect: (error?: Error) => void;
}

/**
 * Enum representing the connection status of an MQTT client.
 */
export type ConnectionStatus =
  | "DISCONNECTED" // The client is not connected to the broker.
  | "CONNECTING" // The client is in the process of establishing a connection to the broker.
  | "CONNECTED"; // The client is successfully connected to the broker.

/**
 * Interface for a codec that handles encoding and decoding of MQTT packets of a specific type.
 */
export interface IMqttPacketCodec<PacketType extends AnyPacket> {
  /**
   * Prepares for manage new stream of bytes, resetting any internal state.
   */
  resetState(): void;

  /**
   * Decodes a buffer of bytes into an MQTT packet.
   * @param packet - The buffer of bytes to be decoded.
   */
  encode(packet: PacketType): Uint8Array;

  /**
   * Decodes a buffer of bytes into an MQTT packet.
   * @param bytes - The buffer of bytes to be decoded.
   */
  decode(bytes: Uint8Array): PacketType | undefined;

  /**
   * Event emitted when a packet is received and decoded.
   * @param packet - The decoded MQTT packet.
   */
  onPacketEvent: (packet: PacketType) => void;
}
