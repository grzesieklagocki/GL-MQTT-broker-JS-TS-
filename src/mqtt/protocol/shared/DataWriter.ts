import { AppError } from "@src/AppError";
import { Uint8ArrayCollectionBase } from "./Uint8ArrayCollectionBase";

export class DataWriter extends Uint8ArrayCollectionBase {
  protected isExported = false;

  /**
   * Returns the number of bytes written to the buffer.
   */
  public get length(): number {
    return this.index;
  }

  /**
   * Returns whether the buffer has been finalized (exported).
   */
  public get isFinalized(): boolean {
    return this.isExported;
  }

  /**
   * Creates a new instance of the DataWriter class with the specified capacity.
   * @param capacity The total capacity of the buffer in bytes. Must be greater than zero.
   */
  constructor(capacity: number) {
    if (capacity < 1) throw new AppError("Capacity must be at least 1");

    const array = new Uint8Array(capacity);
    super(array);
  }

  /**
   * Returns whether the writer can write the specified number of bytes
   * @param bytesCount Number of bytes (default 1)
   * @returns `true` when specified number of bytes can be written, `false` otherwise
   * @throws If length is less than 1
   */
  public canWrite(bytesCount: number = 1): boolean {
    return this.canProcess(bytesCount) && !this.isFinalized;
  }

  /**
   * Exports buffer as `ArrayBuffer`.
   * After calling this method writing (calling `write` method) will be not possible (will throw `Error`s)
   * @returns An `ArrayBuffer` of written bytes
   */
  public toArrayBuffer(): ArrayBuffer {
    this.isExported = true;

    return this.array.buffer as ArrayBuffer;
  }

  /**
   * Writes single byte to the buffer.
   *
   * @param byte - A `number` to write into the buffer.
   * @throws If the buffer is full.
   */
  public write(byte: number): void;

  /**
   * Writes multiple bytes to the buffer.
   *
   * @param bytes - A `Uint8Array` of bytes to write.
   * @throws If there is not enough space for write all bytes.
   */
  public write(bytes: Uint8Array): void;

  /**
   * Writes a single byte or multiple bytes to the buffer.
   * @param data - A `number` or `Uint8Array` to write into the buffer.
   */
  public write(data: number | Uint8Array) {
    if (this.isFinalized)
      throw new AppError("Cannot write to finalized DataWriter");

    if (typeof data === "number") this.writeByte(data);
    else this.writeBytes(data);
  }

  /**
   * Writes a single byte to the buffer.
   * @param byte - A `number` to write into the buffer.
   */
  private writeByte(byte: number): void {
    if (!this.canWrite()) throw new AppError("Buffer overflow");

    this.array[this.index] = byte;

    this.moveIndex(1);
  }

  /**
   * Writes multiple bytes to the buffer.
   * @param bytes - A `Uint8Array` of bytes to write into the buffer.
   */
  private writeBytes(bytes: Uint8Array): void {
    if (!this.canWrite(bytes.length)) throw Error("Buffer overflow");

    this.array.set(bytes, this.index);

    this.moveIndex(bytes.length);
  }
}
