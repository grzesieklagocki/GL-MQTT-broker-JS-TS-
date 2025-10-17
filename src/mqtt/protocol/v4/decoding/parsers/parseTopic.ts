import { AppError } from "@src/AppError";
import { Uint8ArrayToUtf8String } from "@mqtt/protocol/shared/Utf8Conversion";
import { IMQTTReaderV4 } from "../../types";

/**
 * Parses a topic filter from the MQTT packet.
 * @param reader - The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed topic filter.
 * @throws AppError if the topic filter is invalid.
 */
export const parseTopicFilter = (reader: IMQTTReaderV4) =>
  parseTopic(reader, true);

/**
 * Parses a topic name from the MQTT packet.
 * @param reader - The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed topic name.
 * @throws AppError if the topic name is invalid.
 */
export const parseTopicName = (reader: IMQTTReaderV4) =>
  parseTopic(reader, false);

function parseTopic(reader: IMQTTReaderV4, allowWildcards: boolean) {
  try {
    const topic = reader.readString(Uint8ArrayToUtf8String);

    allowWildcards
      ? _assertValidTopicFilter(topic)
      : _assertValidTopicName(topic);

    return topic;
  } catch (error) {
    throw new AppError(
      `Error while parsing topic: ${(error as Error).message}`,
      error as Error
    );
  }
}

function _assertValidTopicFilter(topicFilter: string) {
  // All Topic Names and Topic Filters MUST be at least one character long
  // [MQTT-4.7.3-1]
  if (topicFilter.length < 1)
    throw new AppError(
      `Invalid topic length: ${topicFilter.length}, should be at least 1`
    );
}

function _assertValidTopicName(topicName: string) {
  _assertValidTopicFilter(topicName);

  // The Topic Name in the PUBLISH Packet MUST NOT contain wildcard characters
  // [MQTT-3.3.2-2]
  if (containsWildcard(topicName))
    throw new AppError(
      `Invalid topic filter: ${topicName}. The Topic Name in the PUBLISH Packet MUST NOT contain wildcard characters [MQTT-3.3.2-2]`
    );
}

const containsWildcard = (topicName: string) =>
  topicName.includes("+") || topicName.includes("#");
