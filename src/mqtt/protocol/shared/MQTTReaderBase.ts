import { DataReader } from "./DataReader";

export abstract class MQTTReaderBase extends DataReader {
  /**
   * Creates an instance of the class using the provided byte array.
   * @param array The Uint8Array containing the data to be read.
   */
  public constructor(array: Uint8Array) {
    super(array);
  }

  // Reads a One Byte Integer from the MQTT packet.
  public readOneByteInteger = () => this.read(1)[0];

  // Reads a Two Byte Integer from the MQTT packet.
  public readTwoByteInteger(): number {
    const msb = this.readOneByteInteger();
    const lsb = this.readOneByteInteger();

    const value = (msb << 8) | lsb;

    return value;
  }

  // Reads a Variable Byte Integer from the MQTT packet.
  public readVariableByteInteger(): number {
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

  // Reads binary data from the MQTT packet prefixed with its length (encoded as a two-byte integer).
  public readBinaryData = () => this.readData((data) => data);

  /**
   * Reads a string from the MQTT packet prefixed with its length (encoded as a two-byte integer).
   * Uses the provided UTF-8 string converter to decode the string.
   *
   * @param utf8StringConverter - A function that converts a Uint8Array to a string.
   * @returns The decoded string from the packet.
   */
  public readString = (utf8StringConverter: (data: Uint8Array) => string) =>
    this.readData(utf8StringConverter);

  /**
   * Reads binary data prefixed with its length (encoded as a two-byte integer),
   * then converts the data using the provided converter function.
   *
   * @param converter - A function that takes a Uint8Array of the read data and returns a value of type T.
   * @returns The converted value of type T.
   * @throws Error if the data is malformed or cannot be read.
   */
  protected readData<T>(converter: (data: Uint8Array) => T): T {
    try {
      const bytesCount = this.readTwoByteInteger();
      const array = bytesCount != 0 ? this.read(bytesCount) : new Uint8Array();
      const data = converter(array);

      return data;
    } catch {
      throw Error("Malformed");
    }
  }
}
