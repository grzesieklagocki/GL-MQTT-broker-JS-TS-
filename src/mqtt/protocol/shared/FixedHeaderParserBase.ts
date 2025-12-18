import { AppError } from "@src/AppError";
import { PacketType, FixedHeader, IFixedHeaderValidator } from "./types";

type SimpleReader = { remaining: number; readOneByteInteger(): number };

export abstract class FixedHeaderParserBase<Reader extends SimpleReader> {
  private bytesRead = 0;

  // Fixed Header fields
  private packetType = PacketType.CONNECT;
  private flags = -1;
  private remainingLength = 0;

  // for Remaining Length parsing
  private multiplier = 1;

  // max 4 bytes for Variable Byte Integer
  private hasValidSize = () => this.bytesRead <= 4;

  constructor(private validator: IFixedHeaderValidator) {}

  /**
   * Parse Fixed Header from MQTT v4 stream
   * @param reader reader to read bytes from
   * @returns FixedHeader or null if more bytes are needed
   * @throws AppError if Fixed Header is malformed
   */
  public parse(reader: Reader): FixedHeader | null {
    while (reader.remaining > 0) {
      const byte = reader.readOneByteInteger();

      if (this.bytesRead === 0) {
        this.parseFirstByte(byte);
      } else {
        this.remainingLength += (byte & 0x7f) * this.multiplier;

        if ((byte & 0x80) === 0) {
          // completed Variable Byte Integer sequence
          // validate value and return Fixed Header

          this.validator.assertValidRemainingLength(
            this.packetType,
            this.remainingLength
          );

          return this.createFixedHeader();
        }

        this.multiplier *= 0x80;
      }

      this.bytesRead++;
      this._assertValidSize();
    }

    // still waiting for more bytes
    // to complete Variable Byte Integer sequence
    return null;
  }

  private parsePacketType = (byte: number) => byte >> 4;
  private parseFlags = (byte: number) => byte & 0x0f;

  // Parse first byte to extract Packet Type and Flags
  private parseFirstByte(byte: number) {
    this.packetType = this.parsePacketType(byte);
    this.validator.assertValidPacketType(this.packetType);

    this.flags = this.parseFlags(byte);
    this.validator.assertValidFlags(this.packetType, this.flags);
  }

  // Create Fixed Header object
  private createFixedHeader = (): FixedHeader => {
    return {
      packetType: this.packetType,
      flags: this.flags,
      remainingLength: this.remainingLength,
    };
  };

  // Validate size of Variable Byte Integer (max 4 bytes)
  private _assertValidSize() {
    if (!this.hasValidSize())
      throw new AppError(
        "Malformed Fixed Header: Variable Byte Integer too long"
      );
  }
}
