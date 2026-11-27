import { AppError } from "@src/AppError";
import { PublishFlagsV4 } from "../types";
import { _assertValidTopicName } from "./topic";
import { _assertValidIdentifier } from "./identifier";

/**
 * Asserts that the given PUBLISH packet has valid variable header according to MQTT v4 specs.
 * @param flags - The PublishFlagsV4 object containing the flags to validate.
 * @param topicName - The topic name to validate.
 * @param identifier - The packet identifier to validate (optional).
 * @throws AppError if the packet is invalid.
 */
export function _assertValidPublishVariableHeaderV4(
  flags: PublishFlagsV4,
  topicName: string,
  identifier?: number
) {
  const qos = flags.qosLevel;

  // A PUBLISH Packet MUST NOT have both QoS bits set to 1.
  // If a Server or Client receives a PUBLISH Packet which has both QoS bits set to 1 it MUST close the Network Connection.
  // [MQTT-3.3.1-4]
  if (qos !== 0x00 && qos !== 0x01 && qos !== 0x02)
    throw new AppError(
      `A PUBLISH Packet MUST NOT have both QoS bits set to 1 [MQTT-3.3.1-4]`
    );

  if (qos === 0) {
    // A PUBLISH Packet MUST NOT contain a Packet Identifier if its QoS value is set to 0.
    // [MQTT-2.3.1-5]
    if (identifier !== undefined)
      throw new AppError(
        "QoS 0 messages MUST NOT contain a Packet Identifier [MQTT-2.3.1-5]"
      );

    // The DUP flag MUST be set to 0 for all QoS 0 messages.
    // [MQTT-3.3.1-2]
    if (flags.dup === true) {
      throw new AppError(
        "The DUP flag MUST be set to 0 for all QoS 0 messages [MQTT-3.3.1-2]"
      );
    }
  } else {
    // SUBSCRIBE, UNSUBSCRIBE, and PUBLISH (in cases where QoS > 0) Control Packets MUST contain a non-zero 16-bit Packet Identifier
    // [MQTT-2.3.1-1]
    if (identifier === undefined)
      throw new AppError(
        "For QoS > 0, PUBLISH packets MUST contain a non-zero 16-bit Packet Identifier [MQTT-2.3.1-1]"
      );
    _assertValidIdentifier(identifier);
  }

  // The Topic Name MUST be present as the first field in the PUBLISH Packet Variable header. It MUST be a UTF-8 encoded string.
  // [MQTT-3.3.2-1]
  if (typeof topicName !== "string")
    throw new AppError(
      `Invalid topic filter in UNSUBSCRIBE packet: ${topicName}. Topic Filters must be UTF-8 encoded strings [MQTT-3.3.2-1]`
    );

  // The Topic Name in the PUBLISH Packet MUST NOT contain wildcard characters
  // [MQTT-3.3.2-2]
  //
  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  _assertValidTopicName(topicName);
}
