import { AppError } from "@src/AppError";
import { Uint8ArrayToUtf8String } from "@mqtt/protocol/shared/Utf8Conversion";
import { IMQTTReaderV4 } from "../../types";
import { _assertValidTopicFilter, _assertValidTopicName } from "../../validation/topic";

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
