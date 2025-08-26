import { DataReader } from "./DataReader";

export enum IntegerType {
  oneByte,
  twoByte,
  fourByte,
  variableByte,
}

/**
 * Utility class for reading MQTT packet data from a byte array.
 * Supports reading integers, binary data, and UTF-8 strings.
 */
export class MQTTReader extends DataReader {
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
  public readInteger(type: IntegerType): number {
    switch (type) {
      case IntegerType.oneByte:
        return this.readOneByteInteger();
      case IntegerType.twoByte:
        return this.readTwoByteInteger();
      case IntegerType.fourByte:
        return this.readFourByteInteger();
      case IntegerType.variableByte:
        return this.readVariableByteInteger();
    }
  }

  // Reads binary data from the MQTT packet.
  public readBinaryData = () =>
    this.readData(IntegerType.twoByte, (data) => data);

  /**
   * Reads a string from the MQTT packet using the provided UTF-8 string converter.
   *
   * @param utf8StringConverter - A function that converts a Uint8Array to a string.
   * @returns The decoded string from the packet.
   */
  public readString = (utf8StringConverter: (data: Uint8Array) => string) =>
    this.readData(IntegerType.twoByte, utf8StringConverter);

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

  protected readData<T>(
    bytesCountIntegerType: IntegerType,
    converter: (data: Uint8Array) => T
  ): T {
    try {
      const bytesCount = this.readInteger(bytesCountIntegerType);
      const array = bytesCount != 0 ? this.read(bytesCount) : new Uint8Array();
      const data = converter(array);

      return data;
    } catch {
      throw Error("Malformed");
    }
  }

  private readOneByteInteger = () => this.read(1)[0];

  private readTwoByteInteger(): number {
    const msb = this.readOneByteInteger();
    const lsb = this.readOneByteInteger();

    const value = (msb << 8) | lsb;

    return value;
  }

  private readFourByteInteger(): number {
    const msb = this.readTwoByteInteger();
    const lsb = this.readTwoByteInteger();

    const value = (msb << 16) | lsb;

    return value >>> 0;
  }

  private readVariableByteInteger(): number {
    let multiplier = 1;
    let value = 0;
    let encodedByte: number;
    let encodedBytesCount = 0;

    do {
      try {
        encodedByte = this.readOneByteInteger();
      } catch {
        throw Error("Malformed Variable Byte Integer: incomplete sequence");
      }

      encodedBytesCount++;

      value += (encodedByte & 0x7f) * multiplier;

      multiplier *= 0x80;
    } while ((encodedByte & 0x80) != 0);

    const minimumBytesCountToEncode = (value: number) => {
      if (value <= 0x7f) return 1;
      if (value <= 0x3fff) return 2;
      if (value <= 0x1fffff) return 3;
      return 4;
    };

    if (encodedBytesCount > minimumBytesCountToEncode(value))
      throw Error("Malformed Variable Byte Integer: overlong encoding");

    return value;
  }
}
