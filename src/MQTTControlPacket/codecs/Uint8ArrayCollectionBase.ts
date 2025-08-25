export abstract class Uint8ArrayCollectionBase {
  private _index = 0;

  public get capacity(): number {
    return this.array.length;
  }

  public get remaining(): number {
    return this.capacity - this.index;
  }

  protected get index(): number {
    return this._index;
  }

  constructor(protected readonly array: Uint8Array) {}

  protected canProcess(bytesCount: number): boolean {
    if (bytesCount < 1) throw Error("Bytes count must be at least 1");

    return bytesCount <= this.remaining;
  }

  protected moveIndex(by: number) {
    this._index += by;
  }
}