import { PacketType } from "../../shared/types";
import {
  AnyPacketV4,
  ConnackPacketV4,
  ConnectFlagsV4,
  ConnectPacketV4,
  PublishPacketV4,
} from "../types";
import { encodeStringUtf8 } from "./encodeStringUtf8";
import { MqttWriterV4 } from "./MqttWriterV4";
import { _assertValidConnectVariableHeaderV4 } from "../validation/connect";
import { _assertValidPublishVariableHeaderV4 } from "../validation/publish";
import { _assertValidIdentifier } from "../validation/identifier";

/**
 * Encodes the variable header of an MQTT 3.1.1 packet into a Uint8Array.
 * @param packet - The MQTT packet whose variable header is to be encoded.
 * @returns A Uint8Array representing the encoded variable header of the MQTT packet.
 */
export function encodeVariableHeaderV4(packet: AnyPacketV4): Uint8Array {
  switch (packet.typeId) {
    case PacketType.PINGREQ:
    case PacketType.PINGRESP:
    case PacketType.DISCONNECT:
      return encodeEmptyVariableHeader();
    case PacketType.CONNACK:
      return encodeConnackVariableHeader(packet);
    case PacketType.PUBLISH:
      return encodePublishVariableHeader(packet);
    case PacketType.CONNECT:
      return encodeConnectVariableHeader(packet);
    default:
      return encodeIdentifier(packet.identifier);
  }
}

//
// encoding functions
//

/**
 * Encodes an empty variable header for MQTT packets that do not require a variable header.
 * @returns A Uint8Array representing an empty variable header.
 */
const encodeEmptyVariableHeader = () => new Uint8Array();

/**
 * Encodes the variable header for a CONNACK packet.
 * @param packet - The CONNACK packet to encode.
 * @returns A Uint8Array representing the encoded variable header of the CONNACK packet.
 */
const encodeConnackVariableHeader = (packet: ConnackPacketV4): Uint8Array =>
  new Uint8Array([
    packet.sessionPresentFlag ? 1 : 0, // session present flag
    packet.connectReturnCode, // connect return code
  ]);

/**
 * Encodes the variable header for a PUBLISH packet.
 * @param packet - The PUBLISH packet to encode.
 * @returns A Uint8Array representing the encoded variable header of the PUBLISH packet.
 */
const encodePublishVariableHeader = (packet: PublishPacketV4): Uint8Array => {
  _assertValidPublishVariableHeaderV4(
    packet.flags,
    packet.topicName,
    packet.identifier
  );

  const encodedTopic = encodeStringUtf8(packet.topicName);

  const identifierLength = packet.identifier ? 2 : 0;
  const topicLength = 2 + encodedTopic.length; // 2 bytes for the topic length prefix + topic name length
  const variableHeaderLength = topicLength + identifierLength; // total length of the variable header (topic + optional identifier)

  const writer = new MqttWriterV4(variableHeaderLength);

  // write topic name
  writer.writeBinaryData(encodedTopic);

  // write identifier (if present)
  if (packet.identifier !== undefined)
    writer.writeTwoByteInteger(packet.identifier);

  return writer.toUint8Array();
};

/**
 * Encodes the variable header for a CONNECT packet.
 * @param packet - The CONNECT packet to encode.
 * @returns A Uint8Array representing the encoded variable header of the CONNECT packet.
 */
const encodeConnectVariableHeader = (packet: ConnectPacketV4): Uint8Array => {
  _assertValidConnectVariableHeaderV4(packet.protocol, packet.flags);

  const writer = new MqttWriterV4(10); // 10 bytes for the variable header of CONNECT packet

  writer.writeString(packet.protocol.name);
  writer.writeOneByteInteger(packet.protocol.level);
  writer.writeOneByteInteger(connectFlagsToNumber(packet.flags));
  writer.writeTwoByteInteger(packet.keepAlive);

  return writer.toUint8Array();
};

/**
 * Encodes a two-byte identifier into a Uint8Array.
 * @param identifier - The identifier to encode.
 * @returns A Uint8Array representing the encoded identifier.
 */
const encodeIdentifier = (identifier: number): Uint8Array => {
  _assertValidIdentifier(identifier);

  return new Uint8Array([
    (identifier & 0xff00) >> 8, // MSB
    identifier & 0x00ff, // LSB
  ]);
};

//
// helpers
//

/**
 * Converts the ConnectFlagsV4 object into a number (for encoding).
 * @param flags - The ConnectFlagsV4 object containing the flags to convert.
 * @returns A number representing the encoded connect flags.
 */
const connectFlagsToNumber = (flags: ConnectFlagsV4): number => {
  const userName = flags.userName ? 1 : 0;
  const password = flags.password ? 1 : 0;
  const willRetain = flags.willRetain ? 1 : 0;
  const willQoS = flags.willQoS;
  const willFlag = flags.willFlag ? 1 : 0;
  const cleanSession = flags.cleanSession ? 1 : 0;

  // The Server MUST validate that the reserved flag in the CONNECT Control Packet is set to zero and disconnect the Client if it is not zero.
  // [MQTT-3.1.2-3]
  return (
    (userName << 7) |
    (password << 6) |
    (willRetain << 5) |
    (willQoS << 3) |
    (willFlag << 2) |
    (cleanSession << 1)
  );
};
