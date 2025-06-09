export interface Decoder<T> {
  /**
   * Indicates whether the value is fully decoded
   */
  isDecoded: boolean;

  /**
   * Number of decoded bytes
   */
  decodedBytesCount: number;

  /**
   * Takes next byte of encoded value and tries to decode it
   * @param byte - next byte of decoded value (e.g. from stream)
   * @returns decoded value (if available), `false` if more bytes are needed
   */
  takeNextByte(byte: number): T | false;
}
