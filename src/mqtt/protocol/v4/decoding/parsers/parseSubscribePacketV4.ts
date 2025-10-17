import { AppError } from "@src/AppError";
import { FixedHeader, PacketType, QoS } from "../../../shared/types";
import { IMQTTReaderV4, SubscribePacketV4, SubscriptionV4 } from "../../types";
import { parseIdentifier } from "./parseIdentifier";
import { parseTopicFilter } from "./parseTopic";

/**
 * Parses a SUBSCRIBE MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type, flags, and remaining length before parsing the rest of the packet.
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
  _assertValidFlags(fixedHeader.flags);
  _assertValidRemainingLength(fixedHeader.remainingLength, reader.remaining);

  // parse

  const identifier = parseIdentifier(reader);

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

// only SUBSCRIBE is valid
function _assertValidPacketId(
  id: PacketType
): asserts id is PacketType.SUBSCRIBE {
  if (id !== PacketType.SUBSCRIBE)
    throw new AppError(
      `Invalid packet type: ${id}, expected: ` + `${PacketType.SUBSCRIBE}`
    );
}

// flags must be 0b0010
// Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
// it is reserved for future use and MUST be set to the value listed in that table
// [MQTT-2.2.2-1].
//
// Bits 3,2,1 and 0 of the fixed header of the SUBSCRIBE Control Packet are reserved
// and MUST be set to 0,0,1 and 0 respectively.
// The Server MUST treat any other value as malformed and close the Network Connection
// [MQTT-3.8.1-1]
function _assertValidFlags(flags: number) {
  if (flags !== 0b0010)
    throw new AppError(
      `Invalid packet flags in fixed header: 0b${flags
        .toString(2)
        .padStart(4, "0")}, should be 0b0010`
    );
}

// remaining length must be at least 6
//
//   Packet Identifier: 2 bytes
// + Topic1 Length: 2 bytes
// + Topic1 Data: minimum 1 byte
// + Topic1 QoS: minimum 1 byte
// = minimum 6 bytes
function _assertValidRemainingLength(
  declaredLength: number,
  realLength: number
) {
  if (realLength < 6)
    throw new AppError(
      `Invalid packet remaining length in reader: ${realLength}, should be at least 6`
    );

  if (declaredLength < 6)
    throw new AppError(
      `Invalid packet remaining length in fixed header: ${declaredLength}, should be at least 6`
    );

  if (declaredLength !== realLength)
    throw new AppError(
      `Declared (${declaredLength}) and real (${realLength}) remaining length do not match`
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
