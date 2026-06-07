import { FixedHeader, PacketType } from "@src/mqtt/protocol/shared/types";
import { AnyPacketV4, IMQTTReaderV4 } from "../../types";
import { EmptyPacketV4 } from "./parseEmptyPacketV4";
import { AppError } from "@src/AppError";
import { parseFixedHeaderFlags } from "@src/mqtt/protocol/shared/FixedHeaderFlagsParser";
import { parseConnackPacketV4 } from "./parseConnackPacketV4";
import { parseConnectPacketV4 } from "./parseConnectPacketV4";
import { parsePublishPacketV4 } from "./parsePublishPacketV4";

export function parsePacketV4(
  fixedHeader: FixedHeader,
  reader?: IMQTTReaderV4
): AnyPacketV4 {
  const packetType = fixedHeader.packetType;
  const packet = { typeId: fixedHeader.packetType };

  switch (packetType) {
    case PacketType.PINGREQ:
    case PacketType.PINGRESP:
    case PacketType.DISCONNECT:
      return packet as EmptyPacketV4;
  }

  if (reader === undefined)
    throw new AppError(
      `Reader is required for this packet type: ${PacketType[packetType]}`
    );

  switch (packetType) {
    case PacketType.CONNACK:
      return parseConnackPacketV4(fixedHeader, reader);
    case PacketType.CONNECT:
      return parseConnectPacketV4(fixedHeader, reader);
    case PacketType.PUBLISH:
      return parsePublishPacketV4(fixedHeader, reader);
  }

  const identifier = parseIdentifier(reader);

  switch (packetType) {
    case PacketType.PUBACK:
    case PacketType.PUBREC:
    case PacketType.PUBREL:
    case PacketType.PUBCOMP:
    case PacketType.UNSUBACK:
      return { typeId: packetType, identifier };
  }

  throw new AppError(
    `Unsupported packet type: ${PacketType[packetType]} for protocol version 4 (MQTT 3.1.1)`
  );
}

/**
 * Parses and validates a Packet Identifier from the given reader.
 * @param reader The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed and validated packet identifier.
 * @throws AppError if the identifier is zero.
 */
export function parseIdentifier(reader: IMQTTReaderV4): number {
  const identifier = reader.readTwoByteInteger();
  _assertValidIdentifier(identifier);

  return identifier;
}

// SUBSCRIBE, UNSUBSCRIBE, and PUBLISH (in cases where QoS > 0)
// Control Packets MUST contain a non-zero 16-bit Packet Identifier
// [MQTT-2.3.1-1]
function _assertValidIdentifier(identifier: number) {
  if (identifier === 0) {
    throw new AppError(
      "Invalid packet identifier: 0, ...Control Packets MUST contain a non-zero 16-bit Packet Identifier [MQTT-2.3.1-1]"
    );
  }
}

// function isQosZero(fixedHeader: FixedHeader) {
//   const flags = parseFixedHeaderFlags(fixedHeader.flags);

//   return flags.qos === 0;
// }
