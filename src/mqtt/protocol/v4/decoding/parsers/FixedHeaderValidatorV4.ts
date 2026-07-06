import { AppError } from "@src/AppError";
import { parseFixedHeaderFlags } from "@src/mqtt/protocol/shared/FixedHeaderFlagsParser";
import {
  IFixedHeaderValidator,
  PacketType,
  QoS,
} from "@src/mqtt/protocol/shared/types";

export class FixedHeaderValidatorV4 implements IFixedHeaderValidator {
  // Validate Packet Type
  public assertValidPacketType(type: number): void {
    if (!this.hasValidPacketType(type))
      throw new AppError(
        `Unsupported Fixed Header Packet Type: ${type} (${PacketType[type]}) (for MQTT 3.1.1)`
      );
  }

  // Validate Flags based on Packet Type
  public assertValidFlags(packetType: PacketType, flags: number): void {
    if (!this.hasValidFlags(packetType, flags))
      throw new AppError(
        `Invalid Fixed Header Flags: 0b${flags
          .toString(2)
          .padEnd(4, "0")} for Packet Type: ${PacketType[packetType]}`
      );
  }

  // Validate Remaining Length based on Packet Type
  public assertValidRemainingLength(
    packetType: PacketType,
    remainingLength: number
  ): void {
    if (!this.hasValidRemainingLength(packetType, remainingLength))
      throw new Error(
        `Invalid Fixed Header Remaining Length: ${remainingLength} for Packet Type: ${PacketType[packetType]}`
      );
  }

  private hasValidPacketType(packetType: number): boolean {
    return (
      packetType >= PacketType.CONNECT && packetType <= PacketType.DISCONNECT
    );
  }

  private hasValidFlags(packetType: PacketType, flags: number): boolean {
    if (packetType == PacketType.PUBLISH) {
      const flagsParsed = parseFixedHeaderFlags(flags);

      const qos = flagsParsed.qos;
      this._assertValidQoS(qos);

      const dup = flagsParsed.dup;
      this._assertValidDup(dup, qos);

      return true;
    }

    // Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits, it is reserved for future use and MUST be set to the value listed in that table.
    // [MQTT-2.2.2-1]
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
          .padStart(2, "0")}, should be 0b00, 0b01 or 0b10 [MQTT-3.3.1-4]`
      );
  }

  // The DUP flag MUST be set to 0 for all QoS 0 messages
  // [MQTT-3.3.1-2]
  private _assertValidDup(dup: boolean, qos: QoS) {
    if (qos === 0 && dup === true)
      throw new AppError(
        `The DUP Flag MUST be set to 0 for all QoS 0 messages [MQTT-3.3.1-2]`
      );
  }

  private hasValidRemainingLength(
    packetType: PacketType,
    remainingLength: number
  ): boolean {
    if (remainingLength > 0x0fff_ffff) return false;

    switch (packetType) {
      case PacketType.PINGREQ:
      case PacketType.PINGRESP:
      case PacketType.DISCONNECT:
        // No Variable Header and Payload: 0 bytes
        return remainingLength === 0;

      case PacketType.CONNACK:
      case PacketType.PUBACK:
      case PacketType.PUBREC:
      case PacketType.PUBREL:
      case PacketType.PUBCOMP:
      case PacketType.UNSUBACK:
        // Packet Identifier: 2 bytes
        return remainingLength === 2;

      case PacketType.SUBACK:
      // + Packet Identifier: 2 bytes
      // + Return Codes: minimum 1 byte
      // = 3 bytes
      case PacketType.PUBLISH:
        //   Topic Name Length: 2 bytes
        // + Topic1 Name: minimum 1 byte
        // + Packet Identifier: minimum 0 bytes
        // + Application Message: minimum 0 bytes
        // = minimum 3 bytes
        return remainingLength >= 3;

      case PacketType.UNSUBSCRIBE:
        //   Packet Identifier: 2 bytes
        // + Topic1 Filter Length: 2 bytes
        // + Topic1 Filter Data: minimum 1 byte
        // = minimum 5 bytes
        return remainingLength >= 5;

      case PacketType.SUBSCRIBE:
        //   Packet Identifier: 2 bytes
        // + Topic1 Length: 2 bytes
        // + Topic1 Data: minimum 1 byte
        // + Topic1 QoS: minimum 1 byte
        // = minimum 6 bytes
        return remainingLength >= 6;

      case PacketType.CONNECT:
        //   Protocol Name Length: 2 bytes
        // + Protocol Name: 4 bytes
        // + Protocol Level: 1 byte
        // + Connect Flags: 1 byte
        // + Keep Alive: 2 bytes
        // + Client Identifier: minimum 2 bytes
        // = minimum 12 bytes
        return remainingLength >= 12;
    }
  }
}
