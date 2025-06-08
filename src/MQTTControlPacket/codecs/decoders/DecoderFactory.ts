import { BytesDecoder } from "./BytesDecoder";
import { Decoder } from "./Decoder";
import { VariableByteIntegerDecoder } from "./VariableByteIntegerDecoder";

export enum DecoderType {
  TwoByteInteger,
  FourByteInteger,
  VariableByteInteger,
}
export class DecoderFactory {
  static Create(type: DecoderType): Decoder<number | string> {
    switch (type) {
      case DecoderType.TwoByteInteger:
        return new BytesDecoder(2);
      case DecoderType.FourByteInteger:
        return new BytesDecoder(4);
      case DecoderType.VariableByteInteger:
        return new VariableByteIntegerDecoder();
    }
  }
}
