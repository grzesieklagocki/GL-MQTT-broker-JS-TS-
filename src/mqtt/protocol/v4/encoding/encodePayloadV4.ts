import { PacketType, QoS } from "../../shared/types";
import {
  AnyPacketV4,
  ConnectionPayloadV4,
  ConnectPacketV4,
  PublishPacketV4,
  SubackPacketV4,
  SubscribePacketV4,
  SubscriptionV4,
  UnsubscribePacketV4,
} from "../types";
import { encodeStringUtf8 } from "./encodeStringUtf8";
import { MqttWriterV4 } from "./MqttWriterV4";
import { _assertValidConnectPayloadV4 } from "../validation/connect";
import { _assertValidSubackPayloadV4 } from "../validation/suback";
import { _assertValidSubscribePayloadV4 } from "../validation/subscribe";
import { _assertValidUnsubscribePayloadV4 } from "../validation/unsubscribe";

/**
 * Encodes the payload of an MQTT 3.1.1 packet into a Uint8Array.
 * @param packet - The MQTT packet whose payload is to be encoded.
 * @returns A Uint8Array representing the encoded payload of the MQTT packet.
 */
export function encodePayloadV4(packet: AnyPacketV4): Uint8Array {
  switch (packet.typeId) {
    case PacketType.CONNECT:
      return encodeConnectPayloadV4(packet);
    case PacketType.PUBLISH:
      return encodePublishPayloadV4(packet);
    case PacketType.SUBACK:
      return encodeSubackPayloadV4(packet);
    case PacketType.SUBSCRIBE:
      return encodeSubscribePayloadV4(packet);
    case PacketType.UNSUBSCRIBE:
      return encodeUnsubscribePayloadV4(packet);
    default:
      return encodeEmpty();
  }
}

//
// encoding functions
//

/**
 * Encodes the payload for a CONNECT packet.
 * @param packet - The CONNECT packet to encode.
 * @returns A Uint8Array representing the encoded payload of the CONNECT packet.
 */
const encodeConnectPayloadV4 = (packet: ConnectPacketV4): Uint8Array => {
  _assertValidConnectPayloadV4(packet);

  const payload = getEncodedConnectPayload(packet.payload);
  const length = calculateConnectPayloadLength(payload, packet.flags.willFlag);

  const writer = new MqttWriterV4(length);

  writer.writeBinaryData(payload.clientIdentifierEncoded);

  if (packet.flags.willFlag) {
    writer.writeBinaryData(payload.willTopicEncoded!);
    writer.writeBinaryData(payload.willMessage!); // willMessage is guaranteed to be defined by getEncodedConnectPayload() if willFlag is true
  }

  if (payload.userNameEncoded) writer.writeBinaryData(payload.userNameEncoded);
  if (payload.password) writer.writeBinaryData(payload.password);

  return writer.toUint8Array();
};

/**
 * Encodes the payload for a PUBLISH packet.
 * @param packet - The PUBLISH packet to encode.
 * @returns A Uint8Array representing the encoded payload of the PUBLISH packet.
 */
const encodePublishPayloadV4 = (packet: PublishPacketV4): Uint8Array =>
  packet.applicationMessage ? packet.applicationMessage : encodeEmpty();

/**
 * Encodes the payload for a SUBACK packet.
 * @param packet - The SUBACK packet to encode.
 * @returns A Uint8Array representing the encoded payload of the SUBACK packet.
 */
const encodeSubackPayloadV4 = (packet: SubackPacketV4): Uint8Array => {
  _assertValidSubackPayloadV4(packet);

  return new Uint8Array(packet.returnCodeList);
};

/**
 * Encodes the payload for a SUBSCRIBE packet.
 * @param packet - The SUBSCRIBE packet to encode.
 * @returns A Uint8Array representing the encoded payload of the SUBSCRIBE packet.
 */
const encodeSubscribePayloadV4 = (packet: SubscribePacketV4): Uint8Array => {
  _assertValidSubscribePayloadV4(packet);

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
const encodeUnsubscribePayloadV4 = (
  packet: UnsubscribePacketV4
): Uint8Array => {
  _assertValidUnsubscribePayloadV4(packet);

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

  const willMessage = payload.willMessage
    ? payload.willMessage
    : new Uint8Array();

  return {
    clientIdentifierEncoded: clientIdentifierEncoded,
    willTopicEncoded: willTopicEncoded,
    willMessage: willMessage,
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
const calculateConnectPayloadLength = (
  payload: EncodedConnectPayloadV4,
  hasWill: boolean
) => {
  const clientIdentifierLength =
    2 + // for prefixed length of client identifier
    payload.clientIdentifierEncoded.length;
  const userNameLength = payload.userNameEncoded
    ? 2 + // for prefixed length of username
      payload.userNameEncoded.length
    : 0;
  const passwordLength = payload.password ? 2 + payload.password.length : 0;
  const willLength = hasWill
    ? 2 + // for prefixed length of will topic
      (payload.willTopicEncoded?.length ?? 0) +
      2 + // for prefixed length of will message
      (payload.willMessage?.length ?? 0)
    : 0; // if will flag is not set, will topic and will message are not included in the payload

  // calculate total payload length
  const payloadLength =
    clientIdentifierLength + passwordLength + userNameLength + willLength;

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
