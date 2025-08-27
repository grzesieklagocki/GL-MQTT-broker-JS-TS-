import { Uint8ArrayCollectionBase } from "./Uint8ArrayCollectionBase";

export class DataReader extends Uint8ArrayCollectionBase {
  constructor(array: Uint8Array) {
    super(array);
  }

  /**
   * Returns whether the reader can read the specified number of bytes.
   *
   * @param bytesCount Number of bytes
   * @returns `true` when specified number of bytes can be read, `false` otherwise.
   * @throws If length is less than 1.
   */
  public canRead(bytesCount: number): boolean {
    return this.canProcess(bytesCount);
  }

  /**
   * Reads bytes from the buffer.
   *
   * @param bytesCount - Number of bytes to read
   * @throws If there is not enough bytes in the buffer.
   */
  public read(bytesCount: number): Uint8Array {
    if (!this.canRead(bytesCount))
      throw new Error(
        `Cannot read ${bytesCount} bytes, only ${this.remaining} byte(s) available.`
      );

    const begin = this.index;
    const end = this.index + bytesCount;

    this.moveIndex(bytesCount);

    const bytes = this.array.subarray(begin, end);

    return bytes;
  }
}
