import { AppError } from "@src/AppError";
import {
  IFixedHeaderValidator,
  PacketType,
  QoS,
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

  private parseQoS = (flags: number) => (flags & 0b0110) >> 1;
  private parseDup = (flags: number) => (flags & 0b1000) >> 3;

  private hasValidFlags(packetType: PacketType, flags: number): boolean {
    if (packetType == PacketType.PUBLISH) {
      const qos = this.parseQoS(flags);
      this._assertValidQoS(qos);

      const dup = this.parseDup(flags);
      this._assertValidDup(dup, qos);

      return true;
    }

    if (
      packetType === PacketType.PUBREL ||
      packetType === PacketType.SUBSCRIBE ||
      packetType === PacketType.UNSUBSCRIBE
    )
      return flags === 0b0010;

    return flags === 0b0000;
  }

  // QOS must be 0b00, 0b01 or 0b10
  // A PUBLISH Packet MUST NOT have both QoS bits set to 1.
  // If a Server or Client receives a PUBLISH Packet which has both QoS bits set to 1 it MUST close the Network Connection
  // [MQTT-3.3.1-4]
  private _assertValidQoS(qos: number): asserts qos is QoS {
    if (qos !== 0b00 && qos !== 0b01 && qos !== 0b10)
      throw new AppError(
        `Invalid QoS Flags in fixed header: 0b${qos
          .toString(2)
          .padStart(2, "0")}, should be 0b00, 0b01 or 0b10`
      );
  }

  // The DUP flag MUST be set to 0 for all QoS 0 messages
  // [MQTT-3.3.1-2]
  private _assertValidDup(dup: number, qos: QoS) {
    if (qos === 0 && dup !== 0)
      throw new AppError(
        `The DUP Flag MUST be set to 0 for all QoS 0 messages [MQTT-3.3.1-2]`
      );
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
