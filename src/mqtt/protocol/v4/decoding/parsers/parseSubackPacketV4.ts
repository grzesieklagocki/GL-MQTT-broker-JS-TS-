import { AppError } from "@src/AppError";
import { PacketType } from "../../../shared/types";
import { IMQTTReaderV4, SubackPacketV4, SubackReturnCodeV4 } from "../../types";

/**
 * Parses a SUBACK MQTT packet (for protocol version 3.1.1).
 *
 * Validates the packet type before parsing the rest of the packet.
 * Flags and remaining length in fixed header must be validated before calling this function.
 * Parses and validates the identifier and return code.
 * @param identifier The packet identifier parsed from the variable header.
 * @param reader The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed SUBACK packet.
 */
export function parseSubackPacketV4(
  identifier: number,
  reader: IMQTTReaderV4
): SubackPacketV4 {
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
