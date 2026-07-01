import { FixedHeader } from "../../shared/types";
import { FixedHeaderValidatorV4 } from "../decoding/parsers/FixedHeaderValidatorV4";
import { MqttWriterV4 } from "./MqttWriterV4";

/**
 * Encodes and validates fixed header for an MQTT 3.1.1 packet into a Uint8Array.
 * @param fixedHeader - The fixed header to encode.
 * @returns A Uint8Array representing the encoded fixed header.
 */
export function encodeFixedHeaderV4(fixedHeader: FixedHeader): Uint8Array {
  validateFixedHeaderV4(fixedHeader);

  const writer = new MqttWriterV4(5); // 5 bytes is the maximum size of the fixed header for MQTT 3.1.1
  const firstByte = (fixedHeader.packetType << 4) | fixedHeader.flags;

  writer.writeOneByteInteger(firstByte); // write the first byte
  writer.writeVariableByteInteger(fixedHeader.remainingLength); // write the remaining length

  const array = writer.toUint8Array();

  return array.slice(0, writer.length); // trim the buffer to the actual length of the fixed header
}

/**
 * Validates the fixed header for an MQTT 3.1.1 packet.
 * @param fixedHeader - The fixed header to validate.
 * @throws AppError if the fixed header is invalid.
 */
function validateFixedHeaderV4(fixedHeader: FixedHeader) {
  const validator = new FixedHeaderValidatorV4();

  validator.assertValidPacketType(fixedHeader.packetType);
  validator.assertValidFlags(fixedHeader.packetType, fixedHeader.flags);
  validator.assertValidRemainingLength(
    fixedHeader.packetType,
    fixedHeader.remainingLength
  );
}
