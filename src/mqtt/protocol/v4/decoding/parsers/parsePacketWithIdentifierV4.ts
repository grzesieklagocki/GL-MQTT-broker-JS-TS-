import { AppError } from "@src/AppError";
import { FixedHeader, PacketType } from "../../../shared/types";
import {
  IMQTTReaderV4,
  PubackPacketV4,
  PubcompPacketV4,
  PubrecPacketV4,
  PubrelPacketV4,
  UnsubackPacketV4,
} from "../../types";
import { parseIdentifier } from "./parseIdentifier";

type PacketWithIdentifier =
  | PubackPacketV4
  | PubrecPacketV4
  | PubrelPacketV4
  | PubcompPacketV4
  | UnsubackPacketV4;

type PacketWithIdentifierId =
  | PacketType.PUBACK
  | PacketType.PUBREC
  | PacketType.PUBREL
  | PacketType.PUBCOMP
  | PacketType.UNSUBACK;

/**
 * Parses an MQTT packet (for protocol version 3.1.1) that only contains an identifier.
 *
 * Validates the packet type, flags, and remaining length before parsing the rest of the packet.
 * Parses and validates the identifier.
 *
 * @param fixedHeader - The fixed header of the MQTT packet.
 * @param reader - The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed packet.
 */
export function parsePacketWithIdentifierV4(
  fixedHeader: FixedHeader,
  reader: IMQTTReaderV4
): PacketWithIdentifier {
  // validate fixed header
  _assertValidPacketId(fixedHeader.packetType);
  _assertValidFlags(fixedHeader.flags, fixedHeader.packetType);
  _assertValidRemainingLength(fixedHeader.remainingLength, reader.remaining);

  // parse
  const identifier = parseIdentifier(reader);

  return {
    identifier: identifier,
    typeId: fixedHeader.packetType,
  };
}

//
// assertions helpers
//

// only PUBACK, PUBREC, PUBREL, PUBCOMP and UNSUBACK are valid
function _assertValidPacketId(
  id: PacketType
): asserts id is PacketWithIdentifierId {
  if (
    id !== PacketType.PUBACK &&
    id !== PacketType.PUBREC &&
    id !== PacketType.PUBREL &&
    id !== PacketType.PUBCOMP &&
    id !== PacketType.UNSUBACK
  )
    throw new AppError(
      `Invalid packet type: ${id}, expected: ` +
        `${PacketType.PUBACK}, ${PacketType.PUBREC}, ${PacketType.PUBREL}, ${PacketType.PUBCOMP} or ${PacketType.UNSUBACK}`
    );
}

// flags must be 0b0010 for PUBREL and 0b0000 for others
// Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
// it is reserved for future use and MUST be set to the value listed in that table
// [MQTT-2.2.2-1]
//
// Bits 3,2,1 and 0 of the fixed header in the PUBREL Control Packet are reserved
// and MUST be set to 0,0,1 and 0 respectively.
// The Server MUST treat any other value as malformed and close the Network Connection
// [MQTT-3.6.1-1]
function _assertValidFlags(flags: number, id: PacketType) {
  const expectedFlags = id === PacketType.PUBREL ? 0b0010 : 0b0000;

  if (flags !== expectedFlags) {
    throw new AppError(
      `Invalid packet flags in fixed header: 0b${flags
        .toString(2)
        .padStart(4, "0")}, should be 0b${expectedFlags
        .toString(2)
        .padStart(4, "0")} for packet type ${id}`
    );
  }
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
