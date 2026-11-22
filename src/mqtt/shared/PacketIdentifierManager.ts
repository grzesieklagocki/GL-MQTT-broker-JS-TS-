import { AppError } from "@src/AppError";
import { IPacketIdentifierManager } from "@src/mqtt/shared/types";

/**
 * Class for managing packet identifiers in MQTT protocol.
 */
export class PacketIdentifierManager implements IPacketIdentifierManager {
  private identifiers: number[] = [];
  private cursor = 0;

  /**
   * Returns packet identifier that is not currently in use.
   * @returns The allocated packet identifier.
   */
  public allocateIdentifier(): number {
    if (this.cursor >= 65535)
      throw new AppError("No more packet identifiers available.");

    // if the cursor has reached the end of the identifiers array, add a new identifier
    if (this.cursor === this.identifiers.length)
      this.identifiers.push(this.cursor + 1);

    // return first available identifier and increment cursor
    return this.identifiers[this.cursor++];
  }

  /**
   * Releases a previously allocated packet identifier, making it available again.
   * @param id - The packet identifier to release.
   */
  public releaseIdentifier(id: number): void {
    this.swap(this.findIndexOf(id), --this.cursor);
  }

  //
  // helpers
  //

  /**
   * Swaps two elements in the identifiers array.
   * @param index1 - The index of the first element to swap.
   * @param index2 - The index of the second element to swap.
   */
  private swap(index1: number, index2: number): void {
    const temp = this.identifiers[index1];

    this.identifiers[index1] = this.identifiers[index2];
    this.identifiers[index2] = temp;
  }

  /**
   * Finds the index of a given packet identifier in the allocated section of the identifiers array.
   * @param identifier The packet identifier to find.
   * @returns The index of the packet identifier in the allocated section of the identifiers array.
   */
  private findIndexOf(identifier: number): number {
    // search only in the allocated section of the array (from 0 to cursor-1)
    for (let i = 0; i < this.cursor; i++)
      if (this.identifiers[i] === identifier) return i;

    // if the identifier is not found
    throw new AppError(
      `Cannot release packet identifier ${identifier}, it was not allocated.`
    );
  }
}
