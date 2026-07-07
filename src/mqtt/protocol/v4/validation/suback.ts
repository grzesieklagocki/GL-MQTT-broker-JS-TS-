import { AppError } from "@src/AppError";
import { SubackPacketV4, SubackReturnCodeV4 } from "../types";

/**
 * Asserts that the given SUBACK packet is valid according to MQTT v4 specs.
 * @param packet - The SUBACK packet to validate.
 * @throws AppError if the packet is invalid.
 */
export function _assertValidSubackPayloadV4(packet: SubackPacketV4) {
  packet.returnCodeList.forEach((returnCode) => {
    if (
      returnCode !== SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0 &&
      returnCode !== SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1 &&
      returnCode !== SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_2 &&
      returnCode !== SubackReturnCodeV4.FAILURE
    )
      throw new AppError(
        `Invalid return code in SUBACK packet: ${returnCode}. Valid return codes are: 0x00, 0x01, 0x02, 0x80 [MQTT-3.9.3-2]`
      );
  });
}
