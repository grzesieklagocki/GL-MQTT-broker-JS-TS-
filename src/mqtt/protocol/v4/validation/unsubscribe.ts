import { AppError } from "@src/AppError";
import { UnsubscribePacketV4 } from "../types";

/**
 * Asserts that an UNSUBSCRIBE packet is valid according to MQTT 3.1.1 specification.
 * @param packet - The UNSUBSCRIBE packet to validate.
 * @throws AppError if the packet is invalid.
 */
export function _assertValidUnsubscribePayloadV4(packet: UnsubscribePacketV4) {
  // The Topic Filters in an UNSUBSCRIBE packet MUST be UTF-8 encoded strings as defined in Section 1.5.3, packed contiguously.
  // [MQTT-3.10.3-1]
  packet.topicFilterList.forEach((topicFilter) => {
    if (typeof topicFilter !== "string")
      throw new AppError(
        `Invalid topic filter in UNSUBSCRIBE packet: ${topicFilter}. Topic Filters must be UTF-8 encoded strings [MQTT-3.10.3-1]`
      );
  });

  // The Payload of an UNSUBSCRIBE packet MUST contain at least one Topic Filter.
  // An UNSUBSCRIBE packet with no payload is a protocol violation.
  // [MQTT-3.10.3-2]
  if (packet.topicFilterList.length === 0)
    throw new AppError(
      "The Payload of an UNSUBSCRIBE packet MUST contain at least one Topic Filter. An UNSUBSCRIBE packet with no payload is a protocol violation [MQTT-3.10.3-2]"
    );

  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  packet.topicFilterList.forEach((topic) => {
    if (topic.length === 0)
      throw new AppError(
        "Invalid topic filter: Topic Filter must be at least one character long [MQTT-4.7.3-1]"
      );
  });
}
