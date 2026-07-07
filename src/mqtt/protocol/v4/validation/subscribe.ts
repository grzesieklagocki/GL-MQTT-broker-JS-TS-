import { AppError } from "@src/AppError";
import { SubscribePacketV4 } from "../types";
import { _assertValidTopicLenth } from "./topic";

/**
 * Asserts that a SUBSCRIBE packet is valid according to MQTT 3.1.1 specification.
 * @param packet - The SUBSCRIBE packet to validate.
 * @throws AppError if the packet is invalid.
 */
export function _assertValidSubscribePayloadV4(packet: SubscribePacketV4) {
  // The Topic Filters in a SUBSCRIBE packet payload MUST be UTF-8 encoded strings as defined in Section 1.5.3.
  // [MQTT-3.8.3-1]
  packet.subscriptionList.forEach((subscription) => {
    const topicFilter = subscription[0];

    if (typeof topicFilter !== "string")
      throw new AppError(
        `Invalid topic filter in SUBSCRIBE packet: ${topicFilter}. Topic Filters must be UTF-8 encoded strings [MQTT-3.8.3-1]`
      );
  });

  // The payload of a SUBSCRIBE packet MUST contain at least one Topic Filter / QoS pair. A SUBSCRIBE packet with no payload is a protocol violation.
  // [MQTT-3.8.3-3]
  if (packet.subscriptionList.length === 0)
    throw new AppError(
      "The payload of a SUBSCRIBE packet MUST contain at least one Topic Filter / QoS pair. A SUBSCRIBE packet with no payload is a protocol violation [MQTT-3.8.3-3]"
    );

  // The Server MUST treat a SUBSCRIBE packet as malformed and close the Network Connection if any of Reserved bits in the payload are non-zero, or QoS is not 0,1 or 2.
  // [MQTT-3-8.3-4]
  packet.subscriptionList.forEach((subscription) => {
    const qos = subscription[1];

    if (qos !== 0 && qos !== 1 && qos !== 2)
      throw new AppError(
        `Invalid QoS level in SUBSCRIBE packet: ${qos}. Valid QoS levels are 0, 1, or 2 [MQTT-3.8.3-4]`
      );
  });

  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  packet.subscriptionList.forEach((subscription) => {
    const topic = subscription[0];

    _assertValidTopicLenth(topic);
  });
}
