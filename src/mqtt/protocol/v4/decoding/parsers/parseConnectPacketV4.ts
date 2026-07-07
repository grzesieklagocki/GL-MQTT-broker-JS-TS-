import { Uint8ArrayToUtf8String } from "@src/mqtt/protocol/shared/Utf8Conversion";
import { FixedHeader, PacketType, QoS } from "../../../shared/types";
import {
  ConnectFlagsV4,
  ConnectionPayloadV4,
  ConnectPacketV4,
  IMQTTReaderV4,
} from "../../types";
import { AppError } from "@src/AppError";
import {
  _assertValidConnectPacketV4,
  _assertValidConnectPayloadV4,
  _assertValidConnectProtocolV4,
  _assertValidConnectFlags,
} from "../../validation/connect";

/**
 * Parses a CONNECT MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type before parsing the rest of the packet.
 * Flags and remaining length in fixed header must be validated before calling this function.
 * Parses and validates the protocol name, protocol level, connection flags, and payload.
 * @param fixedHeader The fixed header of the MQTT packet.
 * @param reader The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed CONNECT packet.
 */
export function parseConnectPacketV4(
  fixedHeader: FixedHeader,
  reader: IMQTTReaderV4
): ConnectPacketV4 {
  // validate fixed header
  _assertValidPacketId(fixedHeader.packetType);

  // parse packet

  const protocolName = reader.readString(Uint8ArrayToUtf8String);
  const protocolLevel = reader.readOneByteInteger();

  const protocol = { level: protocolLevel, name: protocolName };
  _assertValidConnectProtocolV4(protocol);

  const connectFlags = parseConnectFlags(reader);
  //_assertValidConnectFlagsV4(connectFlags);

  const keepAlive = reader.readTwoByteInteger();

  const payload = parsePayload(reader, connectFlags);
  _assertValidConnectPayloadV4(payload.clientIdentifier);
  _assertValidConnectPacketV4(connectFlags, payload);

  _assertAllBytesRead(reader);

  return {
    typeId: fixedHeader.packetType,
    protocol: protocol,
    flags: connectFlags,
    keepAlive: keepAlive,
    payload: payload,
  };
}

function parseConnectFlags(reader: IMQTTReaderV4): ConnectFlagsV4 {
  const byte = reader.readOneByteInteger();

  const flags = {
    userName: byte & (1 << 7) ? true : false,
    password: byte & (1 << 6) ? true : false,
    willRetain: byte & (1 << 5) ? true : false,
    willQoS: (byte & 0b00011000) >> 3,
    willFlag: byte & (1 << 2) ? true : false,
    cleanSession: byte & (1 << 1) ? true : false,
    reserved: byte & 1 ? true : false,
  };

  _assertValidConnectFlags(flags);

  return flags;
}

function parsePayload(
  reader: IMQTTReaderV4,
  flags: ConnectFlagsV4
): ConnectionPayloadV4 {
  const identifier = reader.readString(Uint8ArrayToUtf8String);

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

// all bytes must be read
function _assertAllBytesRead(reader: IMQTTReaderV4) {
  if (reader.remaining !== 0)
    throw new AppError(
      `There are still ${reader.remaining} unread byte(s) in the packet`
    );
}
