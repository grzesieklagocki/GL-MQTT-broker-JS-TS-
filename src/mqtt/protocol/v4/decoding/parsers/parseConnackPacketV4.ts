import { AppError } from "@src/AppError";
import { FixedHeader, PacketType } from "../../../shared/types";
import { ConnackPacketV4, ConnackReturnCodeV4 } from "../../types";
import { MQTTReaderV4 } from "../MQTTReaderV4";

/**
 * Parses a CONNACK MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type, flags, and remaining length before parsing the rest of the packet.
 * Parses and validates the session present flag and return code.
 * @param fixedHeader The fixed header of the MQTT packet.
 * @param reader The MQTTReaderV4 instance to read packet data.
 * @returns The parsed CONNACK packet.
 */
export function parseConnackPacketV4(
  fixedHeader: FixedHeader,
  reader: MQTTReaderV4
): ConnackPacketV4 {
  // validate fixed header
  _assertValidPacketId(fixedHeader.packetType);
  _assertValidFlags(fixedHeader.flags);
  _assertValidRemainingLength(fixedHeader.remainingLength, reader.remaining);

  // parse
  const firstByte = reader.readOneByteInteger();
  _assertFirstByte(firstByte);
  const sessionPresent = getSessionPresentFlag(firstByte);

  const returnCode = reader.readOneByteInteger();
  _assertValidReturnCode(returnCode);

  return {
    typeId: PacketType.CONNACK,
    sessionPresentFlag: sessionPresent,
    connectReturnCode: returnCode,
  };
}

const getSessionPresentFlag = (byte: number) =>
  (byte & 0x01) === 0x01 ? true : false;

//
// assertions helpers
//

// only SUBACK is valid
function _assertValidPacketId(id: PacketType): asserts id is PacketType.SUBACK {
  if (id !== PacketType.CONNACK)
    throw new AppError(
      `Invalid packet type: ${id}, expected: ${PacketType.CONNACK}`
    );
}

// flags must be 0b0000
function _assertValidFlags(flags: number) {
  if (flags !== 0b0000)
    throw new AppError(
      `Invalid packet flags in fixed header: 0b${flags
        .toString(2)
        .padStart(4, "0")}, should be 0b0000`
    );
}

// remaining length must be 2
function _assertValidRemainingLength(
  declaredLength: number,
  realLength: number
) {
  if (declaredLength !== 2)
    throw new AppError(
      `Invalid packet remaining length in fixed header: ${declaredLength}, should be 2`
    );

  if (realLength !== 2)
    throw new AppError(
      `Invalid remaining bytes count in reader: ${realLength}, should be 2`
    );
}

// first byte must be 0x00 or 0x01
function _assertFirstByte(byte: number) {
  if (byte !== 0x00 && byte !== 0x01)
    throw new AppError(
      `Invalid first byte: 0x${byte.toString(16)}, should be 0x00 or 0x01`
    );
}

// only 0x00 to 0x05 are valid
function _assertValidReturnCode(
  returnCode: number
): asserts returnCode is ConnackReturnCodeV4 {
  if (returnCode > 0x05)
    throw new AppError(`Invalid CONNACK return code: ${returnCode}`);
}
