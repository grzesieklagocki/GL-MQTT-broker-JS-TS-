import { AppError } from "@src/AppError";
import { UnsubscribePacketV4 } from "../types";
import { _assertValidTopicFilter } from "./topic";

/**
 * Asserts that an UNSUBSCRIBE packet is valid according to MQTT 3.1.1 specification.
 * @param packet - The UNSUBSCRIBE packet to validate.
 * @throws AppError if the packet is invalid.
 */
export function _assertValidUnsubscribePayloadV4(packet: UnsubscribePacketV4) {
  _assertValidUnsubscribeTopicFilterListLength(packet.topicFilterList.length);
  // The Topic Filters in an UNSUBSCRIBE packet MUST be UTF-8 encoded strings as defined in Section 1.5.3, packed contiguously.
  // [MQTT-3.10.3-1]
  packet.topicFilterList.forEach((topicFilter) => {
    _assertValidUnsubscribeTopicFilter(topicFilter);
  });
}

/**
 * Asserts that the given topic filter list length is valid according to MQTT v4 specs.
 * @param length - The length of the topic filter list to validate.
 * @throws AppError if the topic filter list length is invalid.
 */
export function _assertValidUnsubscribeTopicFilterListLength(length: number) {
  // The Payload of an UNSUBSCRIBE packet MUST contain at least one Topic Filter.
  // An UNSUBSCRIBE packet with no payload is a protocol violation.
  // [MQTT-3.10.3-2]
  if (length === 0)
    throw new AppError(
      "The Payload of an UNSUBSCRIBE packet MUST contain at least one Topic Filter. An UNSUBSCRIBE packet with no payload is a protocol violation [MQTT-3.10.3-2]"
    );
}

/**
 * Asserts that the given topic filter is valid according to MQTT v4 specs.
 * @param topicFilter - The topic filter to validate.
 * @throws AppError if the topic filter is invalid.
 */
export function _assertValidUnsubscribeTopicFilter(topicFilter: string) {
  // The Topic Filters in an UNSUBSCRIBE packet MUST be UTF-8 encoded strings as defined in Section 1.5.3, packed contiguously.
  // [MQTT-3.10.3-1]
  if (typeof topicFilter !== "string")
    throw new AppError(
      `Invalid topic filter in UNSUBSCRIBE packet: ${topicFilter}. Topic Filters must be UTF-8 encoded strings [MQTT-3.10.3-1]`
    );

  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  _assertValidTopicFilter(topicFilter);
}
