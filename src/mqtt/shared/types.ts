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
