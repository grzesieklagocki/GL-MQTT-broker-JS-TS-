import { AppError } from "@src/AppError";
import { Uint8ArrayCollectionBase } from "./Uint8ArrayCollectionBase";

export class DataWriter extends Uint8ArrayCollectionBase {
  protected isExported = false;

  public get length(): number {
    return this.index;
  }

  public get isFinalized(): boolean {
    return this.isExported;
  }

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
   * Writes bytes to the buffer.
   *
   * @param bytes - A `Uint8Array` of bytes to write.
   * @throws If there is not enough space for write all bytes.
   */
  public write(bytes: Uint8Array): void;

  public write(data: number | Uint8Array) {
    if (this.isFinalized)
      throw new AppError("Cannot write to finalized DataWriter");

    if (typeof data === "number") this.writeByte(data);
    else this.writeBytes(data);
  }

  private writeByte(byte: number): void {
    if (!this.canWrite()) throw new AppError("Buffer overflow");

    this.array[this.index] = byte;

    this.moveIndex(1);
  }

  private writeBytes(bytes: Uint8Array): void {
    if (!this.canWrite(bytes.length)) throw Error("Buffer overflow");

    this.array.set(bytes, this.index);

    this.moveIndex(bytes.length);
  }
}
