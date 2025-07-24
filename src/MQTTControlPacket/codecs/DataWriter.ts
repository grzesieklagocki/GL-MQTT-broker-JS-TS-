export class DataWriter {
  private array: Uint8Array;
  private index = 0;
  private isExported = false;

  public get capacity() {
    return this.array.length;
  }

  public get length() {
    return this.index;
  }

  public get remaining() {
    return this.capacity - this.length;
  }

  public get isEmpty() {
    return this.length == 0;
  }

  public get isFinalized() {
    return this.isExported;
  }

  constructor(capacity: number) {
    if (capacity < 1) throw Error("Capacity must be at least 1");

    this.array = new Uint8Array(capacity);
  }

  /**
   * Returns whether the writer can write the specified number of bytes
   * @param length Number of bytes (default 1)
   * @returns `true` when specified number of bytes can be written, `false` otherwise
   * @throws If length is less than 1
   */
  public canWrite(length: number = 1) {
    if (length < 1) throw Error("Length must be at least 1");

    return length <= this.remaining && !this.isFinalized;
  }

  /**
   * Exports buffer as `ArrayBuffer`.
   * After calling this method writing (calling `write` method) will be not possible (will throw `Error`s)
   * @returns An `ArrayBuffer` of written bytes
   */
  public toArrayBuffer(): ArrayBuffer {
    this.isExported = true;

    return this.array.buffer;
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
    if (this.isFinalized) throw Error("Cannot write to finalized DataWriter");

    if (typeof data === "number") this.writeByte(data);
    else this.writeBytes(data);
  }

  private writeByte(byte: number) {
    if (!this.canWrite()) throw Error("Buffer overflow");

    this.array[this.index++] = byte;
  }

  private writeBytes(bytes: Uint8Array) {
    bytes.forEach((byte) => this.writeByte(byte));
  }
}
