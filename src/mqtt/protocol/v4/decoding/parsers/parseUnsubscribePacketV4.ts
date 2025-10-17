import { AppError } from "@src/AppError";
import { FixedHeader, PacketType } from "../../../shared/types";
import { IMQTTReaderV4, UnsubscribePacketV4 } from "../../types";
import { Uint8ArrayToUtf8String } from "@mqtt/protocol/shared/Utf8Conversion";
import { parseIdentifier } from "./parseIdentifier";

/**
 * Parses a UNSUBSCRIBE MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type, flags, and remaining length before parsing the rest of the packet.
 * Parses and validates the identifier and topic filter list.
 * @param fixedHeader The fixed header of the MQTT packet.
 * @param reader The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed UNSUBSCRIBE packet.
 */
export function parseUnsubscribePacketV4(
  fixedHeader: FixedHeader,
  reader: IMQTTReaderV4
): UnsubscribePacketV4 {
  // validate fixed header
  _assertValidPacketId(fixedHeader.packetType);
  _assertValidFlags(fixedHeader.flags);
  _assertValidRemainingLength(fixedHeader.remainingLength, reader.remaining);

  // parse

  const identifier = parseIdentifier(reader);

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

function parseTopicFilterList(reader: IMQTTReaderV4) {
  const topicFilterList = [];

  while (reader.remaining > 0) {
    const topicFilter = parseTopicFilter(reader);
    topicFilterList.push(topicFilter);
  }

  return topicFilterList;
}

function parseTopicFilter(reader: IMQTTReaderV4) {
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
// Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
// it is reserved for future use and MUST be set to the value listed in that table
// [MQTT-2.2.2-1]
//
// Bits 3,2,1 and 0 of the fixed header of the UNSUBSCRIBE Control Packet are reserved
// and MUST be set to 0,0,1 and 0 respectively.
// The Server MUST treat any other value as malformed and close the Network Connection
// [MQTT-3.10.1-1]
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

// All Topic Names and Topic Filters MUST be at least one character long
// [MQTT-4.7.3-1]
function _assertValidTopicFilter(topicFilter: string) {
  if (topicFilter.length < 1)
    throw new AppError(
      `Invalid topic filter length: ${topicFilter.length}, should be at least 1`
    );
}
