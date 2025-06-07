import { Decoder } from "./Decoder";

export class BytesDecoder implements Decoder<number> {
  private value: number = 0;
  private decodedCount: number = 0;
  private totalCount: number;

  private get shift(): number {
    return (this.remainingBytes - 1) * 8;
  }

  public get isDecoded(): boolean {
    return this.decodedCount == this.totalCount;
  }

  // Number of bytes needed to complete decoding
  public get remainingBytes(): number {
    return this.totalCount - this.decodedCount;
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

  /**
   * Takes next byte of encoded value and tries to decode it
   * @param byte - next byte of decoded value (e.g. from stream)
   * @returns decoded value from MQTT Control Packet as `number` (if available), `false` otherwise
   */
  public takeNextByte(byte: number): number | false {
    if (this.isDecoded) throw Error("Already decoded");

    this.value |= byte << this.shift;
    this.decodedCount++;

    if (this.isDecoded) return this.value >>> 0;
    return false;
  }
}
