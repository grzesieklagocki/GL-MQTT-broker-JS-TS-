import { AppError } from "@src/AppError";

export abstract class Uint8ArrayCollectionBase {
  private _index = 0;

  /**
   * Total capacity of the buffer
   */
  public get capacity(): number {
    return this.array.length;
  }

  /**
   * Number of bytes that can still be written/read
   */
  public get remaining(): number {
    return this.capacity - this.index;
  }

  /**
   * Creates a new instance of the class with the provided Uint8Array.
   * @param array Byte array to be stored in the collection.
   */
  constructor(protected readonly array: Uint8Array) {}

  /**
   * Current index in the buffer, indicating the position for the next read/write operation.
   */
  protected get index(): number {
    return this._index;
  }

  /**
   * Checks if the specified number of bytes can be processed (read/written) from the current index.
   * @param bytesCount Number of bytes to check for processing.
   * @returns True if the specified number of bytes can be processed; otherwise, false.
   */
  protected canProcess(bytesCount: number): boolean {
    this._assertArgumentInRange(bytesCount);

    return bytesCount <= this.remaining;
  }

  /**
   * Moves the current index by the specified number of bytes.
   * @param by Number of bytes to move the index by.
   */
  protected moveIndex(by: number) {
    this._index += by;
  }

  /**
   * Asserts that the specified number of bytes is within the valid range (greater than 0).
   * @param bytesCount Number of bytes to check.
   */
  private _assertArgumentInRange(bytesCount: number) {
    if (bytesCount < 1) throw new AppError("Bytes count must be at least 1");
  }
}
