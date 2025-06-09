import { Decoder } from "./Decoder";
import { DecoderFactory, DecoderType } from "./DecoderFactory";

export class BinaryDataDecoder<T> implements Decoder<T> {
  private totalBytesCount = -1;
  private decodedCount = 0;
  private lenghtDecoder = DecoderFactory.Create(DecoderType.TwoByteInteger);
  private buffer = new Uint8Array();
  private convert: (buffer: Uint8Array) => T;

  private get isLenghtDecoded() {
    return this.totalBytesCount > -1;
  }

  public get isDecoded() {
    return this.decodedCount == this.totalBytesCount;
  }

  public get decodedBytesCount() {
    return this.decodedCount;
  }

  /**
   * Creates a new instance of BinaryDataDecoder<T>
   * @param convertFunction callback function to convert decoded bytes from Uint8Array to generic type; it is called when decoding is completed
   */
  public constructor(convertFunction: (buffer: Uint8Array) => T) {
    this.convert = convertFunction;
  }

  public takeNextByte(byte: number): T | false {
    if (this.isDecoded) throw new Error("Already decoded");

    if (!this.isLenghtDecoded) {
      const decodedValue = this.lenghtDecoder.takeNextByte(byte);

      if (this.lenghtDecoder.isDecoded) {
        const length = decodedValue as number;

        this.totalBytesCount = length;
        this.buffer = new Uint8Array(length);
      }
    } else {
      this.buffer[this.decodedCount++] = byte;
    }

    if (this.isDecoded) return this.convert(this.buffer);
    return false;
  }
}
