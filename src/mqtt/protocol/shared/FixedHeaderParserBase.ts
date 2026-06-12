import { AppError } from "@src/AppError";
import { PacketType, FixedHeader, IFixedHeaderValidator } from "./types";

export interface ISimpleReader {
  remaining: number;
  readOneByteInteger(): number;
}

export abstract class FixedHeaderParserBase {
  // number of processed bytes for Remaining Length
  private bytesRead = 0;

  // current Fixed Header being parsed
  private fixedHeader: FixedHeader;

  // for Remaining Length parsing
  private multiplier = 1;

  // max 4 bytes for Variable Byte Integer
  private hasValidSize = () => this.bytesRead <= 4;

  /**
   * Creates an instance of FixedHeaderParserBase.
   * @param validator - Validator for Fixed Header fields
   */
  constructor(private validator: IFixedHeaderValidator) {
    this.fixedHeader = this.createInitialFixedHeader();
  }

  /**
   * Parse Fixed Header from MQTT v4 stream
   * @param reader reader to read bytes from
   * @returns FixedHeader or null if more bytes are needed
   * @throws AppError if Fixed Header is malformed
   */
  public parse(reader: ISimpleReader): FixedHeader | null {
    while (reader.remaining > 0) {
      const byte = reader.readOneByteInteger();

      if (this.bytesRead === 0) {
        this.parseFirstByte(byte);
      } else {
        this.fixedHeader.remainingLength += (byte & 0x7f) * this.multiplier;

        if ((byte & 0x80) === 0) {
          // completed Variable Byte Integer sequence
          // validate value and return Fixed Header

          this.validator.assertValidRemainingLength(
            this.fixedHeader.packetType,
            this.fixedHeader.remainingLength
          );

          const fixedHeader = this.fixedHeader;

          this.resetState();

          return fixedHeader;
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
    // parse and validate Packet Type
    this.fixedHeader.packetType = this.parsePacketType(byte);
    this.validator.assertValidPacketType(this.fixedHeader.packetType);

    // parse and validate Flags
    this.fixedHeader.flags = this.parseFlags(byte);
    this.validator.assertValidFlags(
      this.fixedHeader.packetType,
      this.fixedHeader.flags
    );
  }

  // Reset parser state to be ready for next Fixed Header parsing
  private resetState() {
    this.bytesRead = 0;
    this.multiplier = 1;

    this.fixedHeader = this.createInitialFixedHeader();
  }

  // Create an initial Fixed Header with default values
  private createInitialFixedHeader(): FixedHeader {
    return {
      packetType: PacketType.CONNECT,
      flags: -1,
      remainingLength: 0,
    };
  }

  // Validate size of Variable Byte Integer (max 4 bytes)
  private _assertValidSize() {
    if (!this.hasValidSize())
      throw new AppError(
        "Malformed Fixed Header: Variable Byte Integer too long"
      );
  }
}
