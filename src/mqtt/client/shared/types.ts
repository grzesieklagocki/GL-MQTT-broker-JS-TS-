import { AnyPacket, PacketType } from "@mqtt/protocol/shared/types";

/**
 * Interface for a transport adapter that handles MQTT packets of a specific type.
 */
export interface IMqttTransportAdapter<
  TPacket extends AnyPacket,
> /* for emitting events: connected, disconnected, packetReceived */ {
  /**
   * Connects to the transport layer (e.g. TCP) and will emit the "connected" event.
   */
  connect(): Promise<void>;

  /**
   * Sends a packet to the transport layer.
   * @param packet - The MQTT packet to be sent.
   */
  send(packet: TPacket): Promise<void>;

  /**
   * Disconnects the transport layer (e.g. TCP) and will emit the "disconnected" event with provided (optional) error.
   * @param error - Optional error that caused the disconnect.
   */
  disconnect(error?: Error): void;

  /**
   * Callback function to be invoked when a packet is framed and ready to be decoded.
   * @param packetType - The type of the MQTT packet that was framed.
   * @param decodePacket - A function that, when called, will decode the framed packet into an MQTT packet of type TPacket.
   */
  packetReadyHandler: (
    packetType: PacketType,
    decodePacket: () => TPacket
  ) => void;

  /**
   * Callback function to be invoked when the transport layer is disconnected.
   * @param error - Optional error that caused the disconnect.
   */
  disconnectHandler: (error?: Error) => void;
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
export interface IMqttPacketCodec<TPacket extends AnyPacket> {
  /**
   * Prepares for manage new stream of bytes, resetting any internal state.
   */
  resetState(): void;

  /**
   * Decodes a buffer of bytes into an MQTT packet.
   * @param packet - The buffer of bytes to be decoded.
   */
  encode(packet: TPacket): Uint8Array;

  /**
   * Feeds a buffer of bytes to the codec for processing. The codec will handle framing and decoding of the bytes into MQTT packets.
   * @param bytes - The buffer of bytes to be fed to the codec.
   */
  feed(bytes: Uint8Array): void;

  /**
   * Callback function to be invoked when a packet is framed and ready to be decoded.
   * @param packetType - The type of the MQTT packet that was framed.
   * @param decode - A function that, when called, will decode the framed packet into an MQTT packet of type TPacket.
   */
  packetReadyHandler: (packetType: PacketType, decode: () => TPacket) => void;
}
