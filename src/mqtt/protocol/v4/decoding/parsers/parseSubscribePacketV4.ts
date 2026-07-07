import { PacketType } from "../../../shared/types";
import { IMQTTReaderV4, SubscribePacketV4, SubscriptionV4 } from "../../types";
import { parseTopicFilter } from "./parseTopic";
import {
  _assertValidSubscription,
  _assertValidSubscriptionListLength,
} from "../../validation/subscribe";

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
    const qos = reader.readOneByteInteger();

    const subscription: [string, number] = [topic, qos];
    _assertValidSubscription(subscription);

    subscriptionList.push(subscription);
  }
  _assertValidSubscriptionListLength(subscriptionList.length);

  return subscriptionList;
}
