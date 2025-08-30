import { AppError } from "@src/AppError";
import { FixedHeader, PacketType } from "../../../shared/types";
import {
  PingreqPacketV4,
  PingrespPacketV4,
  DisconnectPacketV4,
} from "../../types";
import { MQTTReaderV4 } from "../MQTTReaderV4";

export type EmptyPacketV4 =
  | PingreqPacketV4
  | PingrespPacketV4
  | DisconnectPacketV4;

type EmptyPacketIdV4 =
  | PacketType.PINGREQ
  | PacketType.PINGRESP
  | PacketType.DISCONNECT;

/**
 * Parses an empty MQTT packet (for protocol version 3.1.1).
 * Validates the packet type, flags, and remaining length before returning the parsed packet.
 * @param fixedHeader - The fixed header of the MQTT packet.
 * @param reader - The MQTTReaderV4 instance to read packet data.
 * @returns The parsed packet.
 */
export function parseEmptyPacketV4(
  fixedHeader: FixedHeader,
  reader: MQTTReaderV4
): EmptyPacketV4 {
  // validate fixed header
  _assertValidPacketId(fixedHeader.packetType);
  _assertValidFlags(fixedHeader.flags);
  _assertValidRemainingLength(fixedHeader.remainingLength, reader.remaining);

  // parse
  return { typeId: fixedHeader.packetType };
}

//
// assertions helpers
//

// only PINGREQ, PINGRESP and DISCONNECT are valid
function _assertValidPacketId(id: PacketType): asserts id is EmptyPacketIdV4 {
  if (
    id !== PacketType.PINGREQ &&
    id !== PacketType.PINGRESP &&
    id !== PacketType.DISCONNECT
  )
    throw new AppError(
      `Invalid packet type: ${id}, expected: ` +
        `${PacketType.PINGREQ}, ${PacketType.PINGRESP} or ${PacketType.DISCONNECT}`
    );
}

// flags must be 0b0000
function _assertValidFlags(flags: number) {
  if (flags !== 0x00)
    throw new AppError(
      `Invalid packet flags in fixed header: 0b${flags
        .toString(2)
        .padStart(4, "0")}, should be 0b0000`
    );
}

// remaining length must be 0
function _assertValidRemainingLength(
  declaredLength: number,
  realLength: number
) {
  if (declaredLength !== 0)
    throw new AppError(
      `Invalid packet remaining length in fixed header: ${declaredLength}, should be 0`
    );

  if (realLength !== 0)
    throw new AppError(
      `Invalid remaining bytes count in reader: ${realLength}, should be 0`
    );
}
