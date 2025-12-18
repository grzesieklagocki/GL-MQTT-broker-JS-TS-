import { AppError } from "@src/AppError";
import {
  IFixedHeaderValidator,
  PacketType,
} from "@src/mqtt/protocol/shared/types";

export class FixedHeaderValidatorV4 implements IFixedHeaderValidator {
  // Validate Packet Type
  public assertValidPacketType(type: number): void {
    if (this.hasValidPacketType(type))
      throw new AppError(`Malformed Fixed Header Packet Type: ${type}`);
  }

  // Validate Flags based on Packet Type
  public assertValidFlags(packetType: PacketType, flags: number): void {
    if (!this.hasValidFlags(packetType, flags))
      throw new AppError(
        `Malformed Fixed Header Flags: 0b{${flags
          .toString(2)
          .padEnd(4, "0")}} for Packet Type ${packetType}`
      );
  }

  // Validate Remaining Length based on Packet Type
  public assertValidRemainingLength(
    packetType: PacketType,
    remainingLength: number
  ): void {
    if (!this.hasValidRemainingLength(packetType, remainingLength))
      throw new Error(
        `Invalid Fixed Header Remaining Length (${remainingLength}) for Packet Type ${PacketType[packetType]}`
      );
  }

  private hasValidPacketType(packetType: number): boolean {
    return (
      packetType < PacketType.CONNECT || packetType > PacketType.DISCONNECT
    );
  }

  private hasValidFlags(packetType: PacketType, flags: number): boolean {
    if (packetType == PacketType.PUBLISH) return true;

    if (
      packetType === PacketType.PUBREL ||
      packetType === PacketType.SUBSCRIBE ||
      packetType === PacketType.UNSUBSCRIBE
    )
      return flags === 0b0010;

    return flags === 0b0000;
  }

  private hasValidRemainingLength(
    packetType: PacketType,
    remainingLength: number
  ): boolean {
    switch (packetType) {
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
}
