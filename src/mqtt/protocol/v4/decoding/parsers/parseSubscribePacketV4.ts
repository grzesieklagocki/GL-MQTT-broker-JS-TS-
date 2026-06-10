import { AppError } from "@src/AppError";
import { PacketType, QoS } from "../../../shared/types";
import { IMQTTReaderV4, SubscribePacketV4, SubscriptionV4 } from "../../types";
import { parseTopicFilter } from "./parseTopic";

/**
 * Parses a SUBSCRIBE MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type before parsing the rest of the packet.
 * Flags and remaining length in fixed header must be validated before calling this function.
 * Parses and validates the identifier and subscription list.
 * @param identifier The packet identifier parsed from the variable header.
 * @param reader The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed SUBSCRIBE packet.
 */
export function parseSubscribePacketV4(
  identifier: number,
  reader: IMQTTReaderV4
): SubscribePacketV4 {
  // parse
  const subscriptionList = parseSubscriptionList(reader);

  return {
    typeId: PacketType.SUBSCRIBE,
    identifier: identifier,
    subscriptionList: subscriptionList,
  };
}

//
// parsers helpers
//

function parseSubscriptionList(reader: IMQTTReaderV4) {
  const subscriptionList: SubscriptionV4[] = [];

  while (reader.remaining > 0) {
    const topic = parseTopicFilter(reader);
    const qos = parseQoS(reader);

    subscriptionList.push([topic, qos]);
  }
  _assertValidSubscriptionList(subscriptionList);

  return subscriptionList;
}

function parseQoS(reader: IMQTTReaderV4): QoS {
  const qos = reader.readOneByteInteger();
  _assertValidQoS(qos);

  return qos;
}

//
// assertions helpers
//

// subscription list must contain at least one subscription
function _assertValidSubscriptionList(list: SubscriptionV4[]) {
  if (list.length < 1)
    throw new AppError(
      `Invalid subscription list length: ${list.length}, should be at least 1`
    );
}

// QoS must be 0, 1 or 2
function _assertValidQoS(qos: number): asserts qos is QoS {
  if (qos !== 0x00 && qos !== 0x01 && qos !== 2)
    throw new AppError(`Invalid QoS level: ${qos}, should be 0, 1 or 2`);
}
