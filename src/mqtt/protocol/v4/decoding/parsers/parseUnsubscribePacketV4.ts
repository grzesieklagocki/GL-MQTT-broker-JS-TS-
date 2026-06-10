import { PacketType } from "../../../shared/types";
import { IMQTTReaderV4, UnsubscribePacketV4 } from "../../types";
import { parseTopicFilter } from "./parseTopic";

/**
 * Parses a UNSUBSCRIBE MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type before parsing the rest of the packet.
 * Flags and remaining length in fixed header must be validated before calling this function.
 * Parses and validates the identifier and topic filter list.
 * @param identifier The packet identifier parsed from the variable header.
 * @param reader The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed UNSUBSCRIBE packet.
 */
export function parseUnsubscribePacketV4(
  identifier: number,
  reader: IMQTTReaderV4
): UnsubscribePacketV4 {
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
