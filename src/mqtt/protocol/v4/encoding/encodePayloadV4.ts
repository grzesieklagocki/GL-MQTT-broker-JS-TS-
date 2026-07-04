import { AppError } from "@src/AppError";
import { PacketType, QoS } from "../../shared/types";
import {
  AnyPacketV4,
  ConnectionPayloadV4,
  ConnectPacketV4,
  PublishPacketV4,
  SubackPacketV4,
  SubackReturnCodeV4,
  SubscribePacketV4,
  SubscriptionV4,
  UnsubscribePacketV4,
} from "../types";
import { encodeStringUtf8 } from "./encodeStringUtf8";
import { MqttWriterV4 } from "./MqttWriterV4";

/**
 * Encodes the payload of an MQTT 3.1.1 packet into a Uint8Array.
 * @param packet - The MQTT packet whose payload is to be encoded.
 * @returns A Uint8Array representing the encoded payload of the MQTT packet.
 */
export function encodePayloadV4(packet: AnyPacketV4): Uint8Array {
  switch (packet.typeId) {
    case PacketType.CONNECT:
      return encodeConnectPayload(packet);
    case PacketType.PUBLISH:
      return encodePublishPayload(packet);
    case PacketType.SUBACK:
      return encodeSubackPayload(packet);
    case PacketType.SUBSCRIBE:
      return encodeSubscribePayload(packet);
    case PacketType.UNSUBSCRIBE:
      return encodeUnsubscribePayload(packet);
    default:
      return encodeEmpty();
  }
}

//
// encoding functions
//

const encodeConnectPayload = (packet: ConnectPacketV4): Uint8Array => {
  const payload = getEncodedConnectPayload(packet.payload);
  const length = calculateConnectPayloadLength(payload);

  const writer = new MqttWriterV4(length);

  writer.writeBinaryData(payload.clientIdentifierEncoded);
  if (payload.willTopicEncoded)
    writer.writeBinaryData(payload.willTopicEncoded);
  if (payload.willMessage) writer.writeBinaryData(payload.willMessage);
  if (payload.userNameEncoded) writer.writeBinaryData(payload.userNameEncoded);
  if (payload.password) writer.writeBinaryData(payload.password);

  return writer.toUint8Array();
};

/**
 * Encodes the payload for a PUBLISH packet.
 * @param packet - The PUBLISH packet to encode.
 * @returns A Uint8Array representing the encoded payload of the PUBLISH packet.
 */
const encodePublishPayload = (packet: PublishPacketV4): Uint8Array =>
  packet.applicationMessage;

/**
 * Encodes the payload for a SUBACK packet.
 * @param packet - The SUBACK packet to encode.
 * @returns A Uint8Array representing the encoded payload of the SUBACK packet.
 */
const encodeSubackPayload = (packet: SubackPacketV4): Uint8Array => {
  _assertValidSubackPacket(packet);

  return new Uint8Array(packet.returnCodeList);
};

/**
 * Encodes the payload for a SUBSCRIBE packet.
 * @param packet - The SUBSCRIBE packet to encode.
 * @returns A Uint8Array representing the encoded payload of the SUBSCRIBE packet.
 */
const encodeSubscribePayload = (packet: SubscribePacketV4): Uint8Array => {
  _assertValidSubscribePacket(packet);

  const subscriptionList = getEncodedSubscriptionList(packet.subscriptionList);

  let length = subscriptionList
    .map((subscription) => 2 + subscription.topicFilterEncoded.length + 1)
    .reduce((sum, currentValue) => sum + currentValue);

  const writer = new MqttWriterV4(length);

  subscriptionList.forEach((subscription) =>
    writeSubscription(writer, subscription)
  );

  return writer.toUint8Array();
};

/**
 * Encodes the payload for an UNSUBSCRIBE packet.
 * @param packet - The UNSUBSCRIBE packet to encode.
 * @returns A Uint8Array representing the encoded payload of the UNSUBSCRIBE packet.
 */
const encodeUnsubscribePayload = (packet: UnsubscribePacketV4): Uint8Array => {
  _assertValidUnsubscribePacket(packet);

  const topicFilterList = getEncodedTopicFilterList(packet.topicFilterList);

  // calculate total payload length
  let length = topicFilterList
    .map((filter) => 2 + filter.length)
    .reduce((sum, currentValue) => sum + currentValue);

  const writer = new MqttWriterV4(length);

  topicFilterList.forEach((topic) => writer.writeBinaryData(topic));

  return writer.toUint8Array();
};

/**
 * Encodes an empty payload for MQTT packets that do not require a payload.
 * @returns A Uint8Array representing an empty payload.
 */
const encodeEmpty = () => new Uint8Array();

//
// helpers
//

/**
 * Encodes the string fields of connection payload for a CONNECT packet.
 * @param payload - The connection payload containing client identifier, will topic, will message, username, and password.
 * @returns An object containing the encoded client identifier, username, will topic, and will message as Uint8Arrays.
 */
const getEncodedConnectPayload = (
  payload: ConnectionPayloadV4
): EncodedConnectPayloadV4 => {
  const clientIdentifierEncoded = encodeStringUtf8(payload.clientIdentifier);

  const userNameEncoded = payload.userName
    ? encodeStringUtf8(payload.userName)
    : undefined;

  const willTopicEncoded = payload.willTopic
    ? encodeStringUtf8(payload.willTopic)
    : undefined;

  return {
    clientIdentifierEncoded: clientIdentifierEncoded,
    willTopicEncoded: willTopicEncoded,
    willMessage: payload.willMessage,
    userNameEncoded: userNameEncoded,
    password: payload.password,
  };
};

/**
 * Encodes a list of topic filters into an array of Uint8Arrays using UTF-8.
 * @param topicFilterList - The list of topic filters to encode.
 * @returns An array of Uint8Arrays representing the encoded to UTF-8 topic filters.
 */
const getEncodedTopicFilterList = (topicFilterList: string[]): Uint8Array[] =>
  topicFilterList.map((topicFilter) => encodeStringUtf8(topicFilter));

/**
 * Encodes a list of subscriptions into an array of objects containing the encoded topic filter and QoS level.
 * @param subscriptionList - The list of subscriptions to encode, each containing a topic filter and requested QoS level.
 * @returns An array of objects, each containing the encoded topic filter as a Uint8Array and the requested QoS level.
 */
const getEncodedSubscriptionList = (
  subscriptionList: SubscriptionV4[]
): EncodedSubscription[] => {
  return subscriptionList.map((subscription) => {
    return {
      topicFilterEncoded: encodeStringUtf8(subscription[0]),
      qos: subscription[1],
    };
  });
};

/**
 * Calculates the total length of the payload for a CONNECT packet.
 * @param payload - The connection payload containing client identifier, will topic, will message, username, and password.
 * @returns The total length of the CONNECT packet payload in bytes.
 */
const calculateConnectPayloadLength = (payload: EncodedConnectPayloadV4) => {
  const clientIdentifierLength = 2 + payload.clientIdentifierEncoded.length;
  const willTopicLength = payload.willTopicEncoded
    ? 2 + payload.willTopicEncoded.length
    : 0;
  const willMessageLength = payload.willMessage
    ? 2 + payload.willMessage.length
    : 0;
  const userNameLength = payload.userNameEncoded
    ? 2 + payload.userNameEncoded.length
    : 0;
  const passwordLength = payload.password ? 2 + payload.password.length : 0;

  // calculate total payload length
  const payloadLength =
    clientIdentifierLength +
    passwordLength +
    userNameLength +
    willMessageLength +
    willTopicLength;

  return payloadLength;
};

/**
 * Writes a subscription to the MQTT writer.
 * @param writer - The MQTT writer to write the subscription to.
 * @param subscription - The subscription to write, containing topic filter and requested QoS level.
 */
const writeSubscription = (
  writer: MqttWriterV4,
  subscription: EncodedSubscription
) => {
  writer.writeBinaryData(subscription.topicFilterEncoded);
  writer.writeOneByteInteger(subscription.qos);
};

//
// assertions
//

/**
 * Asserts that the given SUBACK packet is valid according to MQTT v4 specs.
 * @param packet - The SUBACK packet to validate.
 * @throws AppError if the packet is invalid.
 */
function _assertValidSubackPacket(packet: SubackPacketV4) {
  packet.returnCodeList.forEach((returnCode) => {
    if (
      returnCode !== SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0 &&
      returnCode !== SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1 &&
      returnCode !== SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_2 &&
      returnCode !== SubackReturnCodeV4.FAILURE
    )
      throw new AppError(
        `Invalid return code in SUBACK packet: ${returnCode}. Valid return codes are: 0x00, 0x01, 0x02, 0x80 [MQTT-3.9.3-2]`
      );
  });
}

/**
 * Asserts that a SUBSCRIBE packet is valid according to MQTT 3.1.1 specification.
 * @param packet - The SUBSCRIBE packet to validate.
 * @throws AppError if the packet is invalid.
 */
function _assertValidSubscribePacket(packet: SubscribePacketV4) {
  // The payload of a SUBSCRIBE packet MUST contain at least one Topic Filter / QoS pair. A SUBSCRIBE packet with no payload is a protocol violation.
  // [MQTT-3.8.3-3]
  if (packet.subscriptionList.length === 0)
    throw new AppError(
      "The payload of a SUBSCRIBE packet MUST contain at least one Topic Filter / QoS pair. A SUBSCRIBE packet with no payload is a protocol violation [MQTT-3.8.3-3]"
    );

  // The Topic Filters in a SUBSCRIBE packet payload MUST be UTF-8 encoded strings as defined in Section 1.5.3.
  // [MQTT-3.8.3-1]
  //
  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  packet.subscriptionList.forEach((subscription) => {
    if (subscription[0].length === 0)
      throw new AppError(
        "Invalid subscription: Topic Filter must be at least one character long [MQTT-3.8.3-1]"
      );
  });
}

/**
 * Asserts that an UNSUBSCRIBE packet is valid according to MQTT 3.1.1 specification.
 * @param packet - The UNSUBSCRIBE packet to validate.
 * @throws AppError if the packet is invalid.
 */
function _assertValidUnsubscribePacket(packet: UnsubscribePacketV4) {
  // The Topic Filters in an UNSUBSCRIBE packet MUST be UTF-8 encoded strings as defined in Section 1.5.3, packed contiguously.
  // [MQTT-3.10.3-1]
  //
  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  packet.topicFilterList.forEach((topic) => {
    if (topic.length === 0)
      throw new AppError(
        "Invalid topic filter: Topic Filter must be at least one character long [MQTT-3.10.3-1]"
      );
  });

  // The Payload of an UNSUBSCRIBE packet MUST contain at least one Topic Filter.
  // An UNSUBSCRIBE packet with no payload is a protocol violation.
  // [MQTT-3.10.3-2]
  if (packet.topicFilterList.length === 0)
    throw new AppError(
      "The Payload of an UNSUBSCRIBE packet MUST contain at least one Topic Filter. An UNSUBSCRIBE packet with no payload is a protocol violation [MQTT-3.10.3-2]"
    );
}

//
// types
//

type EncodedSubscription = { topicFilterEncoded: Uint8Array; qos: QoS };

type EncodedConnectPayloadV4 = {
  clientIdentifierEncoded: Uint8Array;
  willTopicEncoded?: Uint8Array;
  willMessage?: Uint8Array;
  userNameEncoded?: Uint8Array;
  password?: Uint8Array;
};
