export interface Decoder<T> {
  takeNextByte(byte: number): T | false;
}
