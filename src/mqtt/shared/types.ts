/**
 * Interface for managing packet identifiers in MQTT protocol.
 */
export interface IPacketIdentifierManager {
  /**
   * Generates and returns a unique packet identifier.
   */
  getId(): number;

  /**
   * Releases a previously generated packet identifier, making it available for reuse.
   * @param id - The packet identifier to be released.
   */
  releaseId(id: number): void;
}
