import { PacketType } from "../../../shared/types";
import { IMQTTReaderV4, SubackPacketV4, SubackReturnCodeV4 } from "../../types";
import {
  _assertValidSubackReturnCodeListLength,
  _assertValidSubackReturnCodeV4,
} from "../../validation/suback";

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
  const returnCodeList = parseReturnCodeList(reader);

  return {
    typeId: PacketType.SUBACK,
    identifier: identifier,
    returnCodeList: returnCodeList,
  };
}

//
// parsers helpers
//

function parseReturnCodeList(reader: IMQTTReaderV4): SubackReturnCodeV4[] {
  const returnCodeList: SubackReturnCodeV4[] = [];

  while (reader.remaining > 0) {
    const returnCode = parseReturnCode(reader);

    returnCodeList.push(returnCode);
  }

  _assertValidSubackReturnCodeListLength(returnCodeList.length);

  return returnCodeList;
}

function parseReturnCode(reader: IMQTTReaderV4): SubackReturnCodeV4 {
  const returnCode = reader.readOneByteInteger();
  _assertValidSubackReturnCodeV4(returnCode);

  return returnCode;
}
