import { AppError } from "@src/AppError";
import { FixedHeader, PacketType } from "../../../shared/types";
import {
  PingreqPacketV4,
  PingrespPacketV4,
  DisconnectPacketV4,
  IMQTTReaderV4,
} from "../../types";

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
 * 
 * Validates the packet type before parsing the rest of the packet.
 * Flags and remaining length in fixed header must be validated before calling this function.
 * @param fixedHeader - The fixed header of the MQTT packet.
 * @param reader - The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed packet.
 */
export function parseEmptyPacketV4(
  fixedHeader: FixedHeader,
  _reader: IMQTTReaderV4
): EmptyPacketV4 {
  // validate fixed header
  _assertValidPacketId(fixedHeader.packetType);

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
