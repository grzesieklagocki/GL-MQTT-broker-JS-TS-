import { AppError } from "@src/AppError";
import { FixedHeader, PacketType } from "../../../shared/types";
import { IMQTTReaderV4, SubackPacketV4, SubackReturnCodeV4 } from "../../types";
import { parseIdentifier } from "./parseIdentifier";

/**
 * Parses a SUBACK MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type, flags, and remaining length before parsing the rest of the packet.
 * Parses and validates the identifier and return code.
 * @param fixedHeader The fixed header of the MQTT packet.
 * @param reader The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed SUBACK packet.
 */
export function parseSubackPacketV4(
  fixedHeader: FixedHeader,
  reader: IMQTTReaderV4
): SubackPacketV4 {
  // validate fixed header
  _assertValidPacketId(fixedHeader.packetType);
  _assertValidFlags(fixedHeader.flags);
  _assertValidRemainingLength(fixedHeader.remainingLength, reader.remaining);

  // parse
  const identifier = parseIdentifier(reader);

  const returnCode = reader.readOneByteInteger();
  _assertValidReturnCode(returnCode);

  return {
    typeId: PacketType.SUBACK,
    identifier: identifier,
    returnCode: returnCode,
  };
}

//
// assertions helpers
//

// only SUBACK is valid
function _assertValidPacketId(id: PacketType): asserts id is PacketType.SUBACK {
  if (id !== PacketType.SUBACK)
    throw new AppError(
      `Invalid packet type: ${id}, expected: ${PacketType.SUBACK}`
    );
}

// flags must be 0b00
// Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
// it is reserved for future use and MUST be set to the value listed in that table
// [MQTT-2.2.2-1].
function _assertValidFlags(flags: number) {
  if (flags !== 0b0000)
    throw new AppError(
      `Invalid packet flags in fixed header: 0b${flags
        .toString(2)
        .padStart(4, "0")}, should be 0b0000`
    );
}

// remaining length must be 3
function _assertValidRemainingLength(
  declaredLength: number,
  realLength: number
) {
  if (declaredLength !== 3)
    throw new AppError(
      `Invalid packet remaining length in fixed header: ${declaredLength}, should be 3`
    );

  if (realLength !== 3)
    throw new AppError(
      `Invalid remaining bytes count in reader: ${realLength}, should be 3`
    );
}

// only 0x00, 0x01, 0x02 and 0x80 are valid
function _assertValidReturnCode(
  returnCode: number
): asserts returnCode is SubackReturnCodeV4 {
  if (
    returnCode !== 0x00 &&
    returnCode !== 0x01 &&
    returnCode !== 0x02 &&
    returnCode !== 0x80
  )
    throw new AppError(`Invalid SUBACK return code: ${returnCode}`);
}
