import { Decoder } from "./Decoder";

export class VariableByteIntegerDecoder implements Decoder<number> {
  private value: number = 0;
  private multiplier: number = 1;
  private _isDecoded: boolean = false;

  public get isDecoded() {
    return this._isDecoded;
  }

  public get decodedBytesCount() {
    if (this.value >= 0x200000) return 4;
    
    let count = 0;

    switch (this.multiplier) {
      case 0x80:
        count = 1;
        break;
      case 0x4000:
        count = 2;
        break;
      case 0x200000:
        count = 3;
        break;
      default:
        count = 0;
        break;
    }

    return this.isDecoded ? count + 1 : count;
  }

  public takeNextByte(byte: number): number | false {
    if (this.isDecoded) throw new Error("Already decoded");

    this.value += (byte & 0x7f) * this.multiplier;

    if ((byte & 0x80) === 0) {
      this._isDecoded = true;
      return this.value;
    }

    this.multiplier *= 0x80;

    if (this.multiplier > 0x200000) {
      throw new Error("Malformed Variable Byte Integer");
    }

    return false;
  }
}
