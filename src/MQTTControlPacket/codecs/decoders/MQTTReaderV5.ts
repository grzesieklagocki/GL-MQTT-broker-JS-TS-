import { MQTTReaderBase } from "./MQTTReaderBase";

export enum IntegerTypeV5 {
  oneByte,
  twoByte,
  fourByte,
  variableByte,
}
/**
 * Utility class for reading MQTT 5.0 packet data from a byte array.
 * Extends DataReader to support MQTT 5.0 types.
 */
export class MQTTReaderV5 extends MQTTReaderBase {
  /**
   * Creates an instance of the class using the provided byte array.
   * @param array The Uint8Array containing the data to be read.
   */
  public constructor(array: Uint8Array) {
    super(array);
  }

  /**
   * Reads an integer value from the stream based on the specified integer type.
   *
   * @param type - The type of integer to read.
   * @returns The integer value read from the stream.
   */
  public readInteger(type: IntegerTypeV5): number {
    switch (type) {
      case IntegerTypeV5.oneByte:
        return this.readOneByteInteger();
      case IntegerTypeV5.twoByte:
        return this.readTwoByteInteger();
      case IntegerTypeV5.fourByte:
        return this.readFourByteInteger();
      case IntegerTypeV5.variableByte:
        return this.readVariableByteInteger();
    }
  }

  /**
   * Reads a pair of UTF-8 encoded strings from the MQTT packet.
   *
   * @param utf8StringConverter - A function that converts a Uint8Array to a string.
   * @returns A tuple containing two strings: the name and the value.
   */
  public readStringPair(
    utf8StringConverter: (data: Uint8Array) => string
  ): [string, string] {
    const name = this.readString(utf8StringConverter);
    const value = this.readString(utf8StringConverter);

    return [name, value];
  }

  private readFourByteInteger(): number {
    const msb = this.readTwoByteInteger();
    const lsb = this.readTwoByteInteger();

    const value = (msb << 16) | lsb;

    return value >>> 0;
  }
}
