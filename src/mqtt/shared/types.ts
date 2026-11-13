import { AnyPacket } from "@mqtt/protocol/shared/types";

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
   * Called when a packet is decoded and ready to be processed.
   * @param packet - The type of the MQTT packet that is ready to be processed.
   */
  packetDecodedHandler: (packet: TPacket) => void;
}

/**
 * Interface for an adapter that sends and receives MQTT packets over an existing
 * connection, such as a socket. It does not create the connection, so it can be used
 * with connections provided by the caller (e.g. server sockets).
 */
export interface IMqttSocketTransportAdapter<TPacket extends AnyPacket> {
  /**
   * Sends a packet to the transport layer.
   * @param packet - The MQTT packet to be sent.
   */
  send(packet: TPacket): Promise<void>;

  /**
   * Disconnects the transport layer (e.g. TCP) and invokes the disconnect handler.
   * @param error - Optional error that caused the disconnect.
   */
  disconnect(error?: Error): void;

  /**
   * Callback function to be invoked when an MQTT packet is received from the transport layer.
   * @param packet - The MQTT packet that was received from the transport layer.
   */
  packetReceivedHandler: (packet: TPacket) => void;

  /**
   * Callback function to be invoked when the transport layer is disconnected.
   * @param error - Optional error that caused the disconnect.
   */
  disconnectHandler: (error?: Error) => void;
}

/**
 * Interface for managing packet identifiers in MQTT protocol.
 */
export interface IPacketIdentifierManager {
  /**
   * Generates and returns a new packet identifier that is not currently in use.
   */
  allocateIdentifier(): number;

  /**
   * Releases a previously generated packet identifier, making it available for reuse.
   * @param id - The packet identifier to be released.
   */
  releaseIdentifier(id: number): void;
}

/**
 * Type representing MQTT authentication credentials.
 */
export type MqttAuth = {
  user: string;
  password?: Uint8Array;
};

/**
 * Type representing the executor functions for a Promise, including resolve and reject callbacks.
 */
export type PromiseExecutor<T> = {
  resolve?: (value: T) => void;
  reject?: (error: Error) => void;
};
