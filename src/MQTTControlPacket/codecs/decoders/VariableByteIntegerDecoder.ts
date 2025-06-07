import { Decoder } from "./Decoder";

export class VariableByteIntegerDecoder implements Decoder<number> {
  private value: number = 0;
  private multiplier: number = 1;
  private _isDecoded: boolean = false;

  public get isDecoded() {
    return this._isDecoded;
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
