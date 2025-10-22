import { Uint8ArrayToUtf8String } from "@src/mqtt/protocol/shared/Utf8Conversion";
import { FixedHeader, PacketType, QoS } from "../../../shared/types";
import {
  ConnectFlagsV4,
  ConnectionPayloadV4,
  ConnectPacketV4,
  IMQTTReaderV4,
} from "../../types";
import { AppError } from "@src/AppError";

export function parseConnectPacketV4(
  fixedHeader: FixedHeader,
  reader: IMQTTReaderV4
): ConnectPacketV4 {
  // validate fixed header
  _assertValidPacketId(fixedHeader.packetType);
  _assertValidFlags(fixedHeader.flags);
  _assertValidRemainingLength(fixedHeader.remainingLength, reader.remaining);

  // parse packet

  const protocolName = reader.readString(Uint8ArrayToUtf8String);
  _assertValidProtocolName(protocolName);

  const protocolLevel = reader.readOneByteInteger();
  _assertValidProtocolLevel(protocolLevel);

  const connectFlags = parseConnectFlags(reader);
  _assertValidConnectionFlags(connectFlags);

  const keepAlive = reader.readTwoByteInteger();

  const payload = parsePayload(reader, connectFlags);
  _assertValidConnectionPayload(payload, connectFlags);

  _assertAllBytesRead(reader);

  return {
    typeId: fixedHeader.packetType,
    protocol: {
      name: protocolName,
      level: protocolLevel,
    },
    flags: connectFlags,
    keepAlive: keepAlive,
    payload: payload,
  };
}

function parseConnectFlags(reader: IMQTTReaderV4): ConnectFlagsV4 {
  const byte = reader.readOneByteInteger();

  const qos = (byte & 0b00011000) >> 3;
  _assertValidQoS(qos);

  const reserved = byte & 0b01;
  _assertValidReservedFlag(reserved);

  return {
    userName: (byte & (1 << 7)) !== 0 ? true : false,
    password: (byte & (1 << 6)) !== 0 ? true : false,
    willRetain: (byte & (1 << 5)) !== 0 ? true : false,
    willQoS: qos,
    willFlag: (byte & (1 << 2)) !== 0 ? true : false,
    cleanSession: (byte & (1 << 1)) !== 0 ? true : false,
  };
}

function parsePayload(
  reader: IMQTTReaderV4,
  flags: ConnectFlagsV4
): ConnectionPayloadV4 {
  const identifier = reader.readString(Uint8ArrayToUtf8String);
  _assertValidIdentifier(identifier);

  const willTopic = flags.willFlag
    ? reader.readString(Uint8ArrayToUtf8String)
    : undefined;
  const willMessage = flags.willFlag ? reader.readBinaryData() : undefined;
  const userName = flags.userName
    ? reader.readString(Uint8ArrayToUtf8String)
    : undefined;
  const password = flags.password ? reader.readBinaryData() : undefined;

  return {
    clientIdentifier: identifier,
    willTopic: willTopic,
    willMessage: willMessage,
    userName: userName,
    password: password,
  };
}

//
// assertions helpers
//

// only CONNECT is valid
function _assertValidPacketId(
  id: PacketType
): asserts id is PacketType.CONNECT {
  if (id !== PacketType.CONNECT)
    throw new AppError(
      `Invalid packet type: ${id}, expected: ` + `${PacketType.CONNECT}`
    );
}

// flags must be 0b0000
// Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
// it is reserved for future use and MUST be set to the value listed in that table
// [MQTT-2.2.2-1]
function _assertValidFlags(flags: number) {
  if (flags !== 0b0000)
    throw new AppError(
      `Invalid packet flags in fixed header: 0b${flags
        .toString(2)
        .padStart(4, "0")}, should be 0b0000`
    );
}

// remaining length must be at least 12
//
//   Protocol Name Length: 2 bytes
// + Protocol Name: 4 bytes
// + Protocol Level: 1 byte
// + Connect Flags: 1 byte
// + Keep Alive: 2 bytes
// + Client Identifier: minimum 2 bytes
// = minimum 12 bytes
function _assertValidRemainingLength(
  declaredLength: number,
  realLength: number
) {
  if (realLength < 12)
    throw new AppError(
      `Invalid packet remaining length in reader: ${realLength}, should be at least 12`
    );

  if (declaredLength < 12)
    throw new AppError(
      `Invalid packet remaining length in fixed header: ${declaredLength}, should be at least 12`
    );

  if (declaredLength !== realLength)
    throw new AppError(
      `Declared (${declaredLength}) and real (${realLength}) remaining length do not match`
    );
}

// protocol name must be "MQTT"
function _assertValidProtocolName(name: string): asserts name is "MQTT" {
  if (name !== "MQTT")
    throw new AppError(`Invalid protocol name: ${name}, expected: MQTT`);
}

// protocol level must be 4
function _assertValidProtocolLevel(level: number): asserts level is 4 {
  if (level !== 4)
    throw new AppError(`Invalid protocol level: ${level}, expected: 4`);
}

// If the Will Flag is set to 1, the value of Will QoS can be 0 (0x00), 1 (0x01), or 2 (0x02). It MUST NOT be 3 (0x03)
// [MQTT-3.1.2-14].
function _assertValidQoS(qos: number): asserts qos is QoS {
  if (qos !== 0b00 && qos !== 0b01 && qos !== 0b10)
    throw new AppError(
      `Invalid QoS level: ${qos}. If the Will Flag is set to 1, the value of Will QoS can be 0 (0x00), 1 (0x01), or 2 (0x02). It MUST NOT be 3 (0x03) [MQTT-3.1.2-14].`
    );
}

// The Server MUST validate that the reserved flag in the CONNECT Control Packet is set to zero and disconnect the Client if it is not zero
// [MQTT-3.1.2-3]
function _assertValidReservedFlag(flag: number): asserts flag is 0 {
  if (flag !== 0)
    throw new AppError(
      `The Server MUST validate that the reserved flag in the CONNECT Control Packet is set to zero and disconnect the Client if it is not zero [MQTT-3.1.2-3].`
    );
}

function _assertValidConnectionFlags(flags: ConnectFlagsV4) {
  // If the Will Flag is set to 0
  // the Will QoS and Will Retain fields in the Connect Flags MUST be set to zero
  // and the Will Topic and Will Message fields MUST NOT be present in the payload
  // [MQTT-3.1.2-11]
  // If the Will Flag is set to 0, then the Will QoS MUST be set to 0 (0x00)
  // [MQTT-3.1.2-13]
  // If the Will Flag is set to 0, then the Will Retain Flag MUST be set to 0
  // [MQTT-3.1.2-15]
  if (!flags.willFlag && (flags.willQoS || flags.willRetain))
    throw new AppError(
      `If the Will Flag is set to 0 the Will QoS and Will Retain fields in the Connect Flags MUST be set to zero ` +
        `and the Will Topic and Will Message fields MUST NOT be present in the payload [MQTT-3.1.2-11].`
    );

  // If the User Name Flag is set to 0, the Password Flag MUST be set to 0
  // [MQTT-3.1.2-22].
  if (!flags.userName && flags.password)
    throw new AppError(
      `If the User Name Flag is set to 0, the Password Flag MUST be set to 0 [MQTT-3.1.2-22].`
    );
}

// The Server MUST allow ClientIds which are between 1 and 23 UTF-8 encoded bytes in length,
// and that contain only the characters "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".
// [MQTT-3.1.3-5]
function _assertValidIdentifier(identifier: string) {
  if (identifier.length === 0) return;

  const allowedCharsRegex = /^[0-9a-zA-Z]+$/;
  const hasDisallowedChars = !allowedCharsRegex.test(identifier);

  if (identifier.length > 23 || hasDisallowedChars)
    throw new AppError(
      `The Client Identifier contains invalid characters: ${identifier}. ` +
        `Only "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" are allowed. [MQTT-3.1.3-5]`
    );
}

// validate payload in connection with flags
function _assertValidConnectionPayload(
  payload: ConnectionPayloadV4,
  flags: ConnectFlagsV4
) {
  // If the Client supplies a zero-byte ClientId, the Client MUST also set CleanSession to 1.
  // [MQTT-3.1.3-7]
  if (
    payload.clientIdentifier !== undefined &&
    payload.clientIdentifier.length === 0 &&
    !flags.cleanSession
  )
    throw new AppError(
      `If the Client supplies a zero-byte ClientId, the Client MUST also set CleanSession to 1 [MQTT-3.1.3-7].`
    );
}

// all bytes must be read
function _assertAllBytesRead(reader: IMQTTReaderV4) {
  if (reader.remaining !== 0)
    throw new AppError(
      `There are still ${reader.remaining} unread byte(s) in the packet`
    );
}
