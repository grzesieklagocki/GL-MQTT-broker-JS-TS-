import { AppError } from "@src/AppError";
import { FixedHeader, PacketType } from "../../../shared/types";
import { IMQTTReaderV4, UnsubscribePacketV4 } from "../../types";
import { parseIdentifier } from "./parseIdentifier";
import { parseTopicFilter } from "./parseTopic";

/**
 * Parses a UNSUBSCRIBE MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type before parsing the rest of the packet.
 * Flags and remaining length in fixed header must be validated before calling this function.
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

  // parse

  const identifier = parseIdentifier(reader);

  const topicFilterList = parseTopicFilterList(reader);

  return {
    typeId: fixedHeader.packetType,
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
