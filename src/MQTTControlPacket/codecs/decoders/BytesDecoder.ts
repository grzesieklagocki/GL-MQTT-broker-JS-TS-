import { Decoder } from "./Decoder";

export class BytesDecoder implements Decoder<number> {
  private value: number = 0;
  private decodedCount: number = 0;
  private totalCount: number;

  private get shift(): number {
    return (this.remainingBytes - 1) * 8;
  }

  private get remainingBytes(): number {
    return this.totalCount - this.decodedCount;
  }

  public get isDecoded(): boolean {
    return this.decodedCount == this.totalCount;
  }

  public get decodedBytesCount() {
    return this.decodedCount;
  }

  /**
   * Creates new instance of BytesDecoder
   * @param bytesCount number of bytes to decode
   */
  constructor(bytesCount: number) {
    if (bytesCount < 1 || bytesCount > 4)
      throw Error("`bytesCount` must be in range `<1, 4>`");

    this.totalCount = bytesCount;
  }

  public takeNextByte(byte: number): number | false {
    if (this.isDecoded) throw Error("Already decoded");

    this.value |= byte << this.shift;
    this.decodedCount++;

    if (this.isDecoded) return this.value >>> 0;
    return false;
  }
}
