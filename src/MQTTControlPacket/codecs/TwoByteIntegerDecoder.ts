import { Decoder } from "./Decoder";

export class TwoByteIntegerDecoder implements Decoder<number> {
  private receivedBytes = 0;
  private buffer: number[] = [2];

  /**
   * Takes next byte of encoded value and tries to decode it
   * @param byte - next byte of decoded value (e.g. from stream)
   * @returns decoded value of Two Byte Integer (from MQTT Control Packet) as 'number' (if available), 'false' otherwise
   */
  public takeNextByte(byte: number): number | false {
    this.receivedBytes++;

    if (this.receivedBytes > 2) throw Error("Value already decoded");

    this.buffer[this.receivedBytes - 1] = byte; // write byte to buffer

    if (this.receivedBytes == 2) return this.decode(this.buffer);
    return false;
  }

  /**
   * Decode Two Byte Integer (from MQTT Control Packet) value from bytes array
   * @param bytes - bytes array of decoded value
   * @returns encoded value of Two Byte Integer (from MQTT Control Packet)
   */
  public decode(bytes: number[]): number {
    if (bytes.length != 2)
      throw Error(
        "Length of bytes array of decoded Two Byte Integer need to be 2"
      );

    const msb = bytes[0];
    const lsb = bytes[1];

    return (msb << 8) | lsb;
  }
}
