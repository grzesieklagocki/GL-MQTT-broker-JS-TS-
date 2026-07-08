import { AppError } from "@src/AppError";
import { ConnackPacketV4 } from "../types";

export function _assertValidConnackVariableHeaderV4(packet: ConnackPacketV4) {
  _assertValidConnackReturnCodeV4(packet.connectReturnCode);

  // If a server sends a CONNACK packet containing a non-zero return code it MUST set Session Present to 0.
  // [MQTT-3.2.2-4]
  if (packet.connectReturnCode !== 0 && packet.sessionPresentFlag)
    throw new AppError(
      "Invalid CONNACK packet: Session Present flag MUST be 0 when return code is non-zero [MQTT-3.2.2-4]"
    );
}

/**
 * Asserts that the given return code is valid according to MQTT v4 specs.
 * @param returnCode - The return code to validate.
 * @throws AppError if the return code is invalid.
 */
export function _assertValidConnackReturnCodeV4(returnCode: number) {
  if (
    typeof returnCode !== "number" ||
    (returnCode !== 0 &&
      returnCode !== 1 &&
      returnCode !== 2 &&
      returnCode !== 3 &&
      returnCode !== 4 &&
      returnCode !== 5)
  )
    throw new AppError(`Invalid CONNACK return code: ${returnCode}`);
}
