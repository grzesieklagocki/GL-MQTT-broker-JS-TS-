import { AppError } from "@src/AppError";
import { FixedHeader, PacketType, QoS } from "../../../shared/types";
import { IMQTTReaderV4, PublishFlagsV4, PublishPacketV4 } from "../../types";
import { parseIdentifier } from "./parseIdentifier";
import { parseTopicName } from "./parseTopic";

/**
 * Parses a PUBLISH MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type before parsing the rest of the packet.
 * Flags and remaining length in fixed header must be validated before calling this function.
 * Parses and validates the topic name, identifier and message.
 * @param fixedHeader The fixed header of the MQTT packet.
 * @param reader The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed PUBLISH packet.
 */
export function parsePublishPacketV4(
  fixedHeader: FixedHeader,
  reader: IMQTTReaderV4
): PublishPacketV4 {
  // validate fixed header
  _assertValidPacketId(fixedHeader.packetType);

  // parse
  const flags = parseFlags(fixedHeader.flags);

  const topicName = parseTopicName(reader);

  _assertCanReadIdentifier(flags.qosLevel, reader.remaining);

  const identifier =
    flags.qosLevel === 0x01 || flags.qosLevel === 0x02
      ? parseIdentifier(reader)
      : undefined;

  const message = reader.remaining > 0 ? reader.readBytes() : new Uint8Array();

  _assertAllBytesRead(reader);

  return {
    typeId: fixedHeader.packetType,
    flags: flags,
    topicName: topicName,
    identifier: identifier,
    applicationMessage: message,
  };
}

// Parses the flags from the fixed header
function parseFlags(flags: number): PublishFlagsV4 {
  const retain = flags & 0b0001;
  const qos = (flags & 0b0110) >> 1;
  const dup = (flags & 0b1000) >> 3;

  return {
    retain: retain === 1 ? true : false,
    qosLevel: qos as QoS, // flags are already validated (before call parsePublishPacketV4 function)
    dup: dup === 1 ? true : false,
  };
}

//
// assertions helpers
//

// only PUBLISH is valid
function _assertValidPacketId(
  id: PacketType
): asserts id is PacketType.PUBLISH {
  if (id !== PacketType.PUBLISH)
    throw new AppError(
      `Invalid packet type: ${id}, expected: ` + `${PacketType.PUBLISH}`
    );
}

// Packet Identifier must be present when QoS > 0
function _assertCanReadIdentifier(qos: QoS, remaining: number) {
  if (qos !== 0 && remaining < 2)
    throw new AppError("Not enough bytes to read Packet Identifier");
}

// all bytes must be read
function _assertAllBytesRead(reader: IMQTTReaderV4) {
  if (reader.remaining !== 0)
    throw new AppError(
      `There are still ${reader.remaining} unread byte(s) in the packet`
    );
}
