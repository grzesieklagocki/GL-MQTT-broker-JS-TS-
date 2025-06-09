import { Decoder } from "./Decoder";
import { DecoderFactory, DecoderType } from "./DecoderFactory";

export class BinaryDataDecoder implements Decoder<Uint8Array> {
  private totalBytesCount = -1;
  private decodedCount = 0;
  private lenghtDecoder = DecoderFactory.Create(DecoderType.TwoByteInteger);
  private buffer = new Uint8Array();

  private get isLenghtDecoded() {
    return this.totalBytesCount > -1;
  }

  public get isDecoded() {
    return this.decodedCount == this.totalBytesCount;
  }

  public get decodedBytesCount() {
    return this.decodedCount;
  }

  public takeNextByte(byte: number): Uint8Array | false {
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

    if (this.isDecoded) return this.buffer;
    return false;
  }
}
