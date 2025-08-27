export abstract class Uint8ArrayCollectionBase {
  private _index = 0;

  // Total capacity of the buffer
  public get capacity(): number {
    return this.array.length;
  }

  // Number of bytes that can still be written/read
  public get remaining(): number {
    return this.capacity - this.index;
  }

  /**
   * Creates a new instance of the class with the provided Uint8Array.
   * @param array Byte array to be stored in the collection.
   */
  constructor(protected readonly array: Uint8Array) {}

  protected get index(): number {
    return this._index;
  }

  protected canProcess(bytesCount: number): boolean {
    if (bytesCount < 1) throw Error("Bytes count must be at least 1");

    return bytesCount <= this.remaining;
  }

  protected moveIndex(by: number) {
    this._index += by;
  }
}
