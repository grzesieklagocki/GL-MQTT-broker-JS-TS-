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
 * Validates the packet type before parsing the rest of the packet.
 * Flags and remaining length in fixed header must be validated before calling this function.
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

  // parse
  const identifier = parseIdentifier(reader);

  return {
    typeId: fixedHeader.packetType,
    identifier: identifier,
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
