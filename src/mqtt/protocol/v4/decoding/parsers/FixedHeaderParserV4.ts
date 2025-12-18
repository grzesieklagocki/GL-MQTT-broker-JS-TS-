import { IMQTTReaderV4 } from "../../types";
import { FixedHeader, PacketType } from "@mqtt/protocol/shared/types";
import { AppError } from "@src/AppError";

export class FixedHeaderParserV4 {
  private bytesRead = 0;

  // Fixed Header fields
  private packetType = PacketType.CONNECT;
  private flags = -1;
  private remainingLength = 0;

  // for Remaining Length parsing
  private multiplier = 1;

  // max 4 bytes for Variable Byte Integer
  private hasValidSize = () => this.bytesRead <= 4;

  /**
   * Parse Fixed Header from MQTT v4 stream
   * @param reader reader to read bytes from
   * @returns FixedHeader or null if more bytes are needed
   * @throws AppError if Fixed Header is malformed
   */
  public parse(reader: IMQTTReaderV4): FixedHeader | null {
    while (reader.remaining > 0) {
      const byte = reader.readOneByteInteger();

      if (this.bytesRead === 0) {
        this.parseFirstByte(byte);
      } else {
        this.remainingLength += (byte & 0x7f) * this.multiplier;

        if ((byte & 0x80) === 0) {
          // completed Variable Byte Integer sequence
          // validate value and return Fixed Header

          this._assertValidRemainingLength();
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
    this._assertValidPacketType();

    this.flags = this.parseFlags(byte);
    this._assertValidFlags();
  }

  // Create Fixed Header object
  private createFixedHeader = (): FixedHeader => {
    return {
      packetType: this.packetType,
      flags: this.flags,
      remainingLength: this.remainingLength,
    };
  };

  // Validate Packet Type
  private _assertValidPacketType() {
    if (
      this.packetType < PacketType.CONNECT ||
      this.packetType > PacketType.DISCONNECT
    )
      throw new AppError(
        `Malformed Fixed Header Packet Type: ${this.packetType}`
      );
  }

  // Validate Flags based on Packet Type
  private _assertValidFlags() {
    if (!this.hasValidFlags())
      throw new AppError(
        `Malformed Fixed Header Flags: 0b{${this.flags
          .toString(2)
          .padEnd(4, "0")}} for Packet Type ${this.packetType}`
      );
  }

  // Check if Flags are valid for the given Packet Type
  private hasValidFlags(): boolean {
    const type = this.packetType;
    const flags = this.flags;

    if (type == PacketType.PUBLISH) return true;

    if (
      type === PacketType.PUBREL ||
      type === PacketType.SUBSCRIBE ||
      type === PacketType.UNSUBSCRIBE
    )
      return flags === 0b0010;

    return flags === 0b0000;
  }

  // Validate Remaining Length based on Packet Type
  private _assertValidRemainingLength() {
    if (!this.hasValidRemainingLength())
      throw new Error(
        `Invalid Fixed Header Remaining Length (${
          this.remainingLength
        }) for Packet Type ${PacketType[this.packetType]}`
      );
  }

  // Check if Remaining Length is valid for the given Packet Type
  private hasValidRemainingLength(): boolean {
    const remainingLength = this.remainingLength;

    switch (this.packetType) {
      case PacketType.PINGREQ:
      case PacketType.PINGRESP:
      case PacketType.DISCONNECT:
        return remainingLength === 0;

      case PacketType.CONNACK:
      case PacketType.PUBACK:
      case PacketType.PUBREC:
      case PacketType.PUBREL:
      case PacketType.PUBCOMP:
      case PacketType.UNSUBACK:
        return remainingLength === 2;

      case PacketType.SUBACK:
        return remainingLength === 3;

      case PacketType.PUBLISH:
        return remainingLength >= 3;

      case PacketType.UNSUBSCRIBE:
        return remainingLength >= 5;

      case PacketType.SUBSCRIBE:
        return remainingLength >= 6;

      case PacketType.CONNECT:
        return remainingLength >= 12;
    }
  }

  // Validate size of Variable Byte Integer (max 4 bytes)
  private _assertValidSize() {
    if (!this.hasValidSize())
      throw new AppError(
        "Malformed Fixed Header: Variable Byte Integer too long"
      );
  }
}
