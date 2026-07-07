import { AppError } from "@src/AppError";
import { SubackPacketV4, SubackReturnCodeV4 } from "../types";

/**
 * Asserts that the given SUBACK packet is valid according to MQTT v4 specs.
 * @param packet - The SUBACK packet to validate.
 * @throws AppError if the packet is invalid.
 */
export function _assertValidSubackPayloadV4(packet: SubackPacketV4) {
  _assertValidSubackReturnCodeListLength(packet.returnCodeList.length);

  packet.returnCodeList.forEach((returnCode) => {
    _assertValidSubackReturnCodeV4(returnCode);
  });
}

/**
 * Asserts that the given return code list length is valid according to MQTT v4 specs.
 * @param length - The length of the return code list to validate.
 */
export function _assertValidSubackReturnCodeListLength(length: number) {
  if (length === 0)
    throw new AppError(
      "SUBACK packet MUST contain at least one return code in the payload"
    );
}

/**
 * Asserts that the given return code is valid according to MQTT v4 specs.
 * @param returnCode - The return code to validate.
 * @throws AppError if the return code is invalid.
 */
export function _assertValidSubackReturnCodeV4(returnCode: number) {
  // SUBACK return codes other than 0x00, 0x01, 0x02 and 0x80 are reserved and MUST NOT be used.
  // [MQTT-3.9.3-2]
  if (
    returnCode !== SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0 &&
    returnCode !== SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1 &&
    returnCode !== SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_2 &&
    returnCode !== SubackReturnCodeV4.FAILURE
  )
    throw new AppError(
      `Invalid return code in SUBACK packet: ${returnCode}. Valid return codes are: 0x00, 0x01, 0x02, 0x80 [MQTT-3.9.3-2]`
    );
}
