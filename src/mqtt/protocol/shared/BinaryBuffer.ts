import { AppError } from "@src/AppError";
import { ISimpleReader } from "./types";

export class BinaryBuffer implements ISimpleReader {
  private array: Uint8Array = new Uint8Array();

  // returns the number of bytes in the buffer
  public get remaining() {
    return this.array.length;
  }

  /**
   * Reads one byte
   * @returns The byte read from the buffer as an integer.
   */
  public readOneByteInteger(): number {
    return this.read(1)[0];
  }

  /**
   * Reads the specified number of bytes from the buffer and returns them as a Uint8Array.
   * @param n The number of bytes to read from the buffer. Must be greater than zero and less than or equal to the number of bytes currently in the buffer.
   * @returns A Uint8Array containing the read bytes.
   */
  public read(n: number): Uint8Array {
    if (n <= 0)
      throw new AppError("Number of bytes to read must be greater than zero");
    if (n > this.remaining)
      throw new AppError("Not enough bytes in buffer to read");

    const array = this.array.subarray(0, n);
    this.array = this.array.subarray(n);

    return array;
  }

  /**
   * Writes the provided bytes to the buffer.
   * @param bytes The bytes to be written to the buffer, provided as a Uint8Array.
   */
  public write(bytes: Uint8Array): void {
    this.array = new Uint8Array([...this.array, ...bytes]);
  }
}
