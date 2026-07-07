import { AppError } from "@src/AppError";

/**
 * Asserts that the given identifier is valid according to MQTT v4 specs.
 * @param identifier - The identifier to validate.
 * @throws AppError if the identifier is invalid.
 */
export function _assertValidIdentifier(identifier: number) {
  // SUBSCRIBE, UNSUBSCRIBE, and PUBLISH (in cases where QoS > 0) Control Packets MUST contain a non-zero 16-bit Packet Identifier.
  // [MQTT-2.3.1-1]
  if (identifier === 0)
    throw new AppError(
      "Invalid packet identifier: 0, ...Control Packets MUST contain a non-zero 16-bit Packet Identifier [MQTT-2.3.1-1]"
    );

  if (identifier < 0 || identifier > 0xffff)
    throw new AppError(
      `Invalid packet identifier: ${identifier}, control packet identifiers must be a 16-bit unsigned integer (1-65535)`
    );
}
