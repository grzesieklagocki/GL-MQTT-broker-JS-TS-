import { AppError } from "@src/AppError";
import { containsWildcard } from "../../shared/Utf8Conversion";

/**
 * Asserts that the given topic filter is valid according to MQTT v4 specs.
 * Wildcards are ALLOWED in topic filters.
 * @param topic - The topic to validate.
 * @throws AppError if the topic is invalid.
 */
export function _assertValidTopicFilter(topic: string) {
  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]

  if (topic.length === 0)
    throw new AppError(
      "All Topic Names and Topic Filters MUST be at least one character long [MQTT-4.7.3-1]"
    );
}

/**
 * Asserts that the given topic name is valid according to MQTT v4 specs.
 * Wildcards are NOT ALLOWED in topic names.
 * @param topic - The topic to validate.
 * @throws AppError if the topic is invalid.
 */
export function _assertValidTopicName(topic: string) {
  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  _assertValidTopicFilter(topic);

  // The Topic Name in the PUBLISH Packet MUST NOT contain wildcard characters
  // [MQTT-3.3.2-2]
  if (containsWildcard(topic))
    throw new AppError(
      "The Topic Name in the PUBLISH Packet MUST NOT contain wildcard characters [MQTT-3.3.2-2]"
    );
}
