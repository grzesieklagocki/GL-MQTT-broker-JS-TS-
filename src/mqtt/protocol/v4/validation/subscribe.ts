import { AppError } from "@src/AppError";
import { SubscribePacketV4, SubscriptionV4 } from "../types";
import { _assertValidTopicFilter, _assertValidTopicName } from "./topic";

/**
 * Asserts that a SUBSCRIBE packet is valid according to MQTT 3.1.1 specification.
 * @param packet - The SUBSCRIBE packet to validate.
 * @throws AppError if the packet is invalid.
 */
export function _assertValidSubscribePayloadV4(packet: SubscribePacketV4) {
  _assertValidSubscriptionListLength(packet.subscriptionList.length);

  packet.subscriptionList.forEach((subscription) => {
    _assertValidSubscription(subscription);
  });
}

/**
 * Asserts that the given subscription list length is valid according to MQTT v4 specs.
 * @param length - The length of the subscription list to validate.
 */
export function _assertValidSubscriptionListLength(length: number) {
  // The payload of a SUBSCRIBE packet MUST contain at least one Topic Filter / QoS pair. A SUBSCRIBE packet with no payload is a protocol violation.
  // [MQTT-3.8.3-3]
  if (length === 0)
    throw new AppError(
      "The payload of a SUBSCRIBE packet MUST contain at least one Topic Filter / QoS pair. A SUBSCRIBE packet with no payload is a protocol violation [MQTT-3.8.3-3]"
    );
}

/**
 * Asserts that the given subscription is valid according to MQTT v4 specs.
 * @param subscription - The subscription to validate.
 */
export function _assertValidSubscription(
  subscription: [topicFilter: string, qos: number]
): asserts subscription is SubscriptionV4 {
  const topic = subscription[0];
  const qos = subscription[1];

  // The Topic Filters in a SUBSCRIBE packet payload MUST be UTF-8 encoded strings as defined in Section 1.5.3.
  // [MQTT-3.8.3-1]
  if (typeof topic !== "string")
    throw new AppError(
      `Invalid topic filter in SUBSCRIBE packet: ${topic}. Topic Filters must be UTF-8 encoded strings [MQTT-3.8.3-1]`
    );

  // The Server MUST treat a SUBSCRIBE packet as malformed and close the Network Connection if any of Reserved bits in the payload are non-zero, or QoS is not 0,1 or 2.
  // [MQTT-3-8.3-4]
  if (qos !== 0 && qos !== 1 && qos !== 2)
    throw new AppError(
      `Invalid QoS level in SUBSCRIBE packet: ${qos}. Valid QoS levels are 0, 1, or 2 [MQTT-3.8.3-4]`
    );

  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  _assertValidTopicFilter(topic);
}
