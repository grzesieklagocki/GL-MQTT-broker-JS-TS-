import { AppError } from "@src/AppError";
import { FixedHeader, PacketType, QoS } from "../../../shared/types";
import { IMQTTReaderV4, PublishFlagsV4, PublishPacketV4 } from "../../types";
import { Uint8ArrayToUtf8String } from "@src/mqtt/protocol/shared/Utf8Conversion";
import { parseIdentifier } from "./parseIdentifier";

/**
 * Parses a PUBLISH MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type, flags, and remaining length before parsing the rest of the packet.
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
  _assertValidRemainingLength(fixedHeader.remainingLength, reader.remaining);

  // parse
  const flags = parsePublishFlags(fixedHeader.flags);

  const topicName = reader.readString(Uint8ArrayToUtf8String);
  _assertValidTopic(topicName);

  const identifier =
    flags.qosLevel === 0x01 || flags.qosLevel === 0x02
      ? parseIdentifier(reader)
      : undefined;

  const message = reader.readBytes();
  _assertAllBytesRead(reader);

  return {
    typeId: fixedHeader.packetType,
    flags: flags,
    topicName: topicName,
    identifier: identifier,
    applicationMessage: message,
  };
}

// parsers helpers

// Parses the flags from the fixed header
function parsePublishFlags(flags: number): PublishFlagsV4 {
  const retain = flags & 0b0001;

  const qos = (flags & 0b0110) >> 1;
  _assertValidQoS(qos);

  const dup = (flags & 0b1000) >> 3;
  _assertValidDup(dup, qos);

  return {
    retain: retain === 1 ? true : false,
    qosLevel: qos,
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

// remaining length must be at least 7
//
//   Topic Name Length: 2 bytes
// + Topic1 Name: minimum 1 byte
// + Packet Identifier: 2 bytes
// + Application Message: minimum 2 bytes
// = minimum 7 bytes
function _assertValidRemainingLength(
  declaredLength: number,
  realLength: number
) {
  if (realLength < 7)
    throw new AppError(
      `Invalid packet remaining length in reader: ${realLength}, should be at least 5`
    );

  if (declaredLength < 7)
    throw new AppError(
      `Invalid packet remaining length in fixed header: ${declaredLength}, should be at least 5`
    );

  if (declaredLength !== realLength)
    throw new AppError(
      `Declared (${declaredLength}) and real (${realLength}) remaining length do not match`
    );
}

// QOS must be 0b00, 0b01 or 0b10
// A PUBLISH Packet MUST NOT have both QoS bits set to 1.
// If a Server or Client receives a PUBLISH Packet which has both QoS bits set to 1 it MUST close the Network Connection
// [MQTT-3.3.1-4].
function _assertValidQoS(qos: number): asserts qos is QoS {
  if (qos !== 0b00 && qos !== 0b01 && qos !== 0b10)
    throw new AppError(
      `Invalid QoS flags in fixed header: 0b${qos
        .toString(2)
        .padStart(2, "0")}, should be 0b00, 0b01 or 0b10`
    );
}

// The DUP flag MUST be set to 0 for all QoS 0 messages
// [MQTT-3.3.1-2]
function _assertValidDup(dup: number, qos: QoS) {
  if (qos === 0 && dup !== 0)
    throw new AppError(
      `The DUP flag MUST be set to 0 for all QoS 0 messages [MQTT-3.3.1-2]`
    );
}

function _assertValidTopic(topicFilter: string) {
  // All Topic Names and Topic Filters MUST be at least one character long
  // [MQTT-4.7.3-1]
  if (topicFilter.length < 1)
    throw new AppError(
      `Invalid topic length: ${topicFilter.length}. All Topic Names and Topic Filters MUST be at least one character long [MQTT-4.7.3-1]`
    );

  // The Topic Name in the PUBLISH Packet MUST NOT contain wildcard characters
  // [MQTT-3.3.2-2]
  if (topicFilter.includes("+") || topicFilter.includes("#"))
    throw new AppError(
      `Invalid topic filter: ${topicFilter}. The Topic Name in the PUBLISH Packet MUST NOT contain wildcard characters [MQTT-3.3.2-2]`
    );
}

// all bytes must be read
function _assertAllBytesRead(reader: IMQTTReaderV4) {
  if (reader.remaining !== 0)
    throw new AppError(
      `There are still ${reader.remaining} unread byte(s) in the packet`
    );
}
