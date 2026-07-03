import { AppError } from "@src/AppError";
import { DataWriter } from "../../shared/DataWriter";
import { encodeStringUtf8 } from "./encodeStringUtf8";

export class MqttWriterV4 extends DataWriter {
  /**
   * Creates a new instance of the MqttWriterV4 class with the specified capacity.
   * @param capacity The total capacity of the buffer in bytes. Must be greater than zero.
   */
  public constructor(capacity: number) {
    super(capacity);
  }

  /**
   * Writes binary data to the buffer, prefixed with its length as a Two Byte Integer.
   * @param bytes The binary data to be written to the buffer, provided as a Uint8Array.
   */
  public writeBinaryData(bytes: Uint8Array): void {
    // write prefixed length
    this.writeTwoByteInteger(bytes.length);
    // write data
    if (bytes.length > 0) this.write(bytes);
  }

  /**
   * Writes a string to the buffer, prefixed with its length as a Two Byte Integer.
   * @param str The string to be written to the buffer.
   */
  public writeString(str: string) {
    // encode string to bytes
    const data = encodeStringUtf8(str);

    // write as binary data with prefixed length
    this.writeBinaryData(data);
  }

  /**
   * Writes a One Byte Integer to the buffer.
   * @param value The value to be written as a One Byte Integer. Must be between 0 and 255 (0xff).
   * @throws If the value is outside the valid range for a One Byte Integer.
   */
  public writeOneByteInteger(value: number): void {
    if (value < 0 || value > 0xff)
      throw new AppError(
        "Value must be between 0 and 255 for One Byte Integer"
      );

    this.write(value);
  }

  /**
   * Writes a Two Byte Integer to the buffer.
   * @param value The value to be written as a Two Byte Integer. Must be between 0 and 65535 (0xffff).
   * @throws If the value is outside the valid range for a Two Byte Integer.
   */
  public writeTwoByteInteger(value: number): void {
    if (value < 0 || value > 0xffff)
      throw new AppError(
        "Value must be between 0 and 65535 for Two Byte Integer"
      );

    const msb = value >> 8;
    const lsb = value & 0x00ff;

    this.write(msb);
    this.write(lsb);
  }

  /**
   * Writes a Variable Byte Integer to the buffer.
   * @param value The value to be written as a Variable Byte Integer. Must be between 0 and 268435455 (0x0fff_ffff).
   * @throws If the value is outside the valid range for a Variable Byte Integer.
   */
  public writeVariableByteInteger(value: number): void {
    if (value < 0 || value > 0x0fff_ffff)
      throw new AppError(
        "Value must be between 0 and 268435455 for Variable Byte Integer"
      );

    do {
      let encodedByte = value % 0x80;
      value = (value / 0x80) >> 0;

      // if there are more data to encode, set the top bit of this byte
      if (value > 0) {
        encodedByte = encodedByte | 0x80;
      }

      this.write(encodedByte);
    } while (value > 0);
  }
}
