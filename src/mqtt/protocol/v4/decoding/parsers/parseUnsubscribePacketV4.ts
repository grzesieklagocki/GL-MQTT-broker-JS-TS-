import { AppError } from "@src/AppError";
import { FixedHeader, PacketType } from "../../../shared/types";
import { UnsubscribePacketV4 } from "../../types";
import { MQTTReaderV4 } from "../MQTTReaderV4";
import { Uint8ArrayToUtf8String } from "@mqtt/protocol/shared/Utf8Conversion";

/**
 * Parses a UNSUBSCRIBE MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type, flags, and remaining length before parsing the rest of the packet.
 * Parses and validates the identifier and topic filter list.
 * @param fixedHeader The fixed header of the MQTT packet.
 * @param reader The MQTTReaderV4 instance to read packet data.
 * @returns The parsed UNSUBSCRIBE packet.
 */
export function parseUnsubscribePacketV4(
  fixedHeader: FixedHeader,
  reader: MQTTReaderV4
): UnsubscribePacketV4 {
  // validate fixed header
  _assertValidPacketId(fixedHeader.packetType);
  _assertValidFlags(fixedHeader.flags);
  _assertValidRemainingLength(fixedHeader.remainingLength, reader.remaining);

  // parse
  const identifier = reader.readTwoByteInteger();
  const topicFilterList = parseTopicFilterList(reader);

  return {
    typeId: PacketType.UNSUBSCRIBE,
    identifier: identifier,
    topicFilterList: topicFilterList,
  };
}

//
// parsers helpers
//

function parseTopicFilterList(reader: MQTTReaderV4) {
  const topicFilterList = [];

  while (reader.remaining > 0) {
    const topicFilter = parseTopicFilter(reader);
    topicFilterList.push(topicFilter);
  }

  return topicFilterList;
}

function parseTopicFilter(reader: MQTTReaderV4) {
  try {
    const topicFilter = reader.readString(Uint8ArrayToUtf8String);
    _assertValidTopicFilter(topicFilter);

    return topicFilter;
  } catch (error) {
    throw new AppError(`Error while parsing topic filter`, error as Error);
  }
}

//
// assertions helpers
//

// only UNSUBSCRIBE is valid
function _assertValidPacketId(
  id: PacketType
): asserts id is PacketType.UNSUBSCRIBE {
  if (id !== PacketType.UNSUBSCRIBE)
    throw new AppError(
      `Invalid packet type: ${id}, expected: ` + `${PacketType.UNSUBSCRIBE}`
    );
}

// flags must be 0b0010
function _assertValidFlags(flags: number) {
  if (flags !== 0b0010)
    throw new AppError(
      `Invalid packet flags in fixed header: 0b${flags
        .toString(2)
        .padStart(4, "0")}, should be 0b0010`
    );
}

// remaining length must be at least 5
//
//   Packet Identifier: 2 bytes
// + Topic1 Filter Length: 2 bytes
// + Topic1 Filter Data: minimum 1 byte
// = minimum 5 bytes
function _assertValidRemainingLength(
  declaredLength: number,
  realLength: number
) {
  if (realLength < 5)
    throw new AppError(
      `Invalid packet remaining length in reader: ${realLength}, should be at least 5`
    );

  if (declaredLength < 5)
    throw new AppError(
      `Invalid packet remaining length in fixed header: ${declaredLength}, should be at least 5`
    );

  if (declaredLength !== realLength)
    throw new AppError(
      `Declared (${declaredLength}) and real (${realLength}) remaining length do not match`
    );
}

// topic filter must be at least 1 character long
function _assertValidTopicFilter(topicFilter: string) {
  if (topicFilter.length < 1)
    throw new AppError(
      `Invalid topic filter length: ${topicFilter.length}, should be at least 1`
    );
}
