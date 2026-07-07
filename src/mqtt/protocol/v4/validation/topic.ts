import { AppError } from "@src/AppError";

/**
 * Asserts that the given topic is valid according to MQTT v4 specs.
 * @param topic - The topic to validate.
 * @throws AppError if the topic is invalid.
 */
export function _assertValidTopicLenth(topic: string) {
  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]

  if (topic.length === 0)
    throw new AppError(
      "All Topic Names and Topic Filters MUST be at least one character long [MQTT-4.7.3-1]"
    );
}
