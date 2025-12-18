import { AppError } from "@src/AppError";
import { FixedHeader, PacketType } from "../../../shared/types";
import { IMQTTReaderV4, SubackPacketV4, SubackReturnCodeV4 } from "../../types";
import { parseIdentifier } from "./parseIdentifier";

/**
 * Parses a SUBACK MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type before parsing the rest of the packet.
 * Flags and remaining length in fixed header must be validated before calling this function.
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

  // parse
  const identifier = parseIdentifier(reader);

  const returnCode = reader.readOneByteInteger();
  _assertValidReturnCode(returnCode);

  return {
    typeId: fixedHeader.packetType,
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

// SUBACK return codes other than 0x00, 0x01, 0x02 and 0x80 are reserved and MUST NOT be used.
// [MQTT-3.9.3-2]
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
