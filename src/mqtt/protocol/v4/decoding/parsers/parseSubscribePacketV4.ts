import { AppError } from "@src/AppError";
import { FixedHeader, PacketType, QoS } from "../../../shared/types";
import { IMQTTReaderV4, SubscribePacketV4, SubscriptionV4 } from "../../types";
import { parseIdentifier } from "./parseIdentifier";
import { parseTopicFilter } from "./parseTopic";

/**
 * Parses a SUBSCRIBE MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type before parsing the rest of the packet.
 * Flags and remaining length in fixed header must be validated before calling this function.
 * Parses and validates the identifier and subscription list.
 * @param fixedHeader The fixed header of the MQTT packet.
 * @param reader The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed SUBSCRIBE packet.
 */
export function parseSubscribePacketV4(
  fixedHeader: FixedHeader,
  reader: IMQTTReaderV4
): SubscribePacketV4 {
  // validate fixed header
  _assertValidPacketId(fixedHeader.packetType);

  // parse

  const identifier = parseIdentifier(reader);

  const subscriptionList = parseSubscriptionList(reader);

  return {
    typeId: fixedHeader.packetType,
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

// only SUBSCRIBE is valid
function _assertValidPacketId(
  id: PacketType
): asserts id is PacketType.SUBSCRIBE {
  if (id !== PacketType.SUBSCRIBE)
    throw new AppError(
      `Invalid packet type: ${id}, expected: ` + `${PacketType.SUBSCRIBE}`
    );
}

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
