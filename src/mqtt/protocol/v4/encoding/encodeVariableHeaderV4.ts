import { AppError } from "@src/AppError";
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
import { containsWildcard } from "../../shared/Utf8Conversion";

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
  _assertValidPublishPacketV4(packet);

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
  _assertValidConnectPacketV4(packet);

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

//
// assertions
//

/**
 * Asserts that the given CONNECT packet is valid according to MQTT v4 specs.
 * @param packet - The CONNECT packet to validate.
 * @throws AppError if the packet is invalid.
 */
function _assertValidConnectPacketV4(packet: ConnectPacketV4) {
  // If the protocol name is incorrect the Server MAY disconnect the Client,
  // or it MAY continue processing the CONNECT packet in accordance with some other specification.
  // In the latter case, the Server MUST NOT continue to process the CONNECT packet in line with this specification.
  // [MQTT-3.1.2-1]
  if (packet.protocol.level !== 4) {
    throw new AppError(
      `Invalid protocol level: ${packet.protocol.level}, expected 4 for MQTT 3.1.1 [MQTT-3.1.2-1]`
    );
  }

  // If the Will Flag is set to 0 the Will QoS and Will Retain fields in the Connect Flags MUST be set to zero
  // and the Will Topic and Will Message fields MUST NOT be present in the payload.
  // [MQTT-3.1.2-11]
  if (
    !packet.flags.willFlag &&
    (packet.payload.willTopic !== undefined ||
      packet.payload.willMessage !== undefined)
  )
    throw new AppError(
      "If the Will Flag is set to 0 the Will QoS and Will Retain fields in the Connect Flags MUST be set to zero and the Will Topic and Will Message fields MUST NOT be present in the payload [MQTT-3.1.2-11]"
    );

  // If the Will Flag is set to 0, then the Will QoS MUST be set to 0 (0x00).
  // [MQTT-3.1.2-13]
  if (!packet.flags.willFlag && packet.flags.willQoS !== 0)
    throw new AppError(
      "If the Will Flag is set to 0, then the Will QoS MUST be set to 0 (0x00) [MQTT-3.1.2-13], [MQTT-3.1.2-11]"
    );

  // If the Will Flag is set to 1, the value of Will QoS can be 0 (0x00), 1 (0x01), or 2 (0x02).
  // It MUST NOT be 3 (0x03).
  // [MQTT-3.1.2-14]
  if (
    packet.flags.willFlag &&
    packet.flags.willQoS !== 0b00 &&
    packet.flags.willQoS !== 0b01 &&
    packet.flags.willQoS !== 0b10
  )
    throw new AppError(
      "If the Will Flag is set to 1, the value of Will QoS can be 0 (0x00), 1 (0x01), or 2 (0x02). It MUST NOT be 3 (0x03) [MQTT-3.1.2-14]"
    );

  // If the Will Flag is set to 0, then the Will Retain Flag MUST be set to 0.
  // [MQTT-3.1.2-15]
  if (!packet.flags.willFlag && packet.flags.willRetain)
    throw new AppError(
      "If the Will Flag is set to 0, then the Will Retain Flag MUST be set to 0 [MQTT-3.1.2-15], [MQTT-3.1.2-11]"
    );
}

/**
 * Asserts that the given PUBLISH packet is valid according to MQTT v4 specs.
 * @param packet - The PUBLISH packet to validate.
 * @throws AppError if the packet is invalid.
 */
function _assertValidPublishPacketV4(packet: PublishPacketV4) {
  if (packet.flags.qosLevel === 0) {
    // A PUBLISH Packet MUST NOT contain a Packet Identifier if its QoS value is set to 0.
    // [MQTT-2.3.1-5]
    if (packet.identifier !== undefined)
      throw new AppError(
        "QoS 0 messages MUST NOT contain a Packet Identifier [MQTT-2.3.1-5]"
      );

    // The DUP flag MUST be set to 0 for all QoS 0 messages.
    // [MQTT-3.3.1-2]
    if (packet.flags.dup === true) {
      throw new AppError(
        "The DUP flag MUST be set to 0 for all QoS 0 messages [MQTT-3.3.1-2]"
      );
    }
  }

  const qos = packet.flags.qosLevel;

  // A PUBLISH Packet MUST NOT have both QoS bits set to 1.
  // If a Server or Client receives a PUBLISH Packet which has both QoS bits set to 1 it MUST close the Network Connection.
  // [MQTT-3.3.1-4]
  if (qos !== 0x00 && qos !== 0x01 && qos !== 0x02)
    throw new AppError(
      `A PUBLISH Packet MUST NOT have both QoS bits set to 1 [MQTT-3.3.1-4]`
    );

  // The Topic Name MUST be present as the first field in the PUBLISH Packet Variable header. It MUST be a UTF-8 encoded string.
  // [MQTT-3.3.2-1]
  //
  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  if (packet.topicName.length === 0)
    throw new AppError(
      `All Topic Names and Topic Filters MUST be at least one character long [MQTT-4.7.3-1]`
    );

  // The Topic Name in the PUBLISH Packet MUST NOT contain wildcard characters.
  // [MQTT-3.3.2-2]
  if (containsWildcard(packet.topicName))
    throw new AppError(
      `The Topic Name in the PUBLISH Packet MUST NOT contain wildcard characters [MQTT-3.3.2-2]`
    );
}

/**
 * Asserts that the given identifier is valid according to MQTT v4 specs.
 * @param identifier - The identifier to validate.
 * @throws AppError if the identifier is invalid.
 */
function _assertValidIdentifier(identifier: number) {
  // SUBSCRIBE, UNSUBSCRIBE, and PUBLISH (in cases where QoS > 0) Control Packets MUST contain a non-zero 16-bit Packet Identifier.
  // [MQTT-2.3.1-1]
  if (identifier === 0)
    throw new AppError(
      "Invalid packet identifier: 0, ...Control Packets MUST contain a non-zero 16-bit Packet Identifier [MQTT-2.3.1-1]"
    );

  if (identifier < 0 || identifier > 0xffff)
    throw new AppError(
      `Invalid packet identifier: ${identifier}, control packet identifiers must be a 16-bit unsigned integer (1-65535)`
    );
}
