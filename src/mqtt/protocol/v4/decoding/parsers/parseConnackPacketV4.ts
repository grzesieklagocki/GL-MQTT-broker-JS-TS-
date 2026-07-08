import { AppError } from "@src/AppError";
import { FixedHeader, PacketType } from "../../../shared/types";
import { ConnackPacketV4, IMQTTReaderV4 } from "../../types";
import {
  _assertValidConnackReturnCodeV4,
  _assertValidConnackVariableHeaderV4,
} from "../../validation/connack";

/**
 * Parses a CONNACK MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type before parsing the rest of the packet.
 * Flags and remaining length in fixed header must be validated before calling this function.
 * Parses and validates the session present flag and return code.
 * @param fixedHeader The fixed header of the MQTT packet.
 * @param reader The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed CONNACK packet.
 */
export function parseConnackPacketV4(
  fixedHeader: FixedHeader,
  reader: IMQTTReaderV4
): ConnackPacketV4 {
  // validate fixed header
  _assertValidPacketId(fixedHeader.packetType);

  // parse
  const firstByte = reader.readOneByteInteger();
  _assertValidFirstByte(firstByte);
  const sessionPresent = getSessionPresentFlag(firstByte);

  const returnCode = reader.readOneByteInteger();
  _assertValidConnackReturnCodeV4(returnCode);

  const packet = {
    typeId: fixedHeader.packetType,
    sessionPresentFlag: sessionPresent,
    connectReturnCode: returnCode,
  };
  _assertValidConnackVariableHeaderV4(packet);

  return packet;
}

const getSessionPresentFlag = (byte: number) => (byte === 1 ? true : false);

//
// assertions helpers
//

// only SUBACK is valid
function _assertValidPacketId(
  id: PacketType
): asserts id is PacketType.CONNACK {
  if (id !== PacketType.CONNACK)
    throw new AppError(
      `Invalid packet type: ${id}, expected: ${PacketType.CONNACK}`
    );
}

// first byte must be 0x00 or 0x01
function _assertValidFirstByte(byte: number) {
  if (byte !== 0x00 && byte !== 0x01)
    throw new AppError(
      `Invalid first byte: 0x${byte.toString(16)}, should be 0x00 or 0x01`
    );
}
