import { AppError } from "@src/AppError";
import { IMQTTReaderV4 } from "../../types";

/**
 * Parses and validates a Packet Identifier from the given reader.
 * @param reader The IMQTTReaderV4 instance to read packet data.
 * @returns The parsed and validated packet identifier.
 * @throws AppError if the identifier is zero.
 */
export function parseIdentifier(reader: IMQTTReaderV4): number {
  const identifier = reader.readTwoByteInteger();
  _assertValidIdentifier(identifier);

  return identifier;
}

// SUBSCRIBE, UNSUBSCRIBE, and PUBLISH (in cases where QoS > 0)
// Control Packets MUST contain a non-zero 16-bit Packet Identifier
// [MQTT-2.3.1-1]
function _assertValidIdentifier(identifier: number) {
  if (identifier === 0) {
    throw new AppError(
      "Invalid packet identifier: 0, ...Control Packets MUST contain a non-zero 16-bit Packet Identifier [MQTT-2.3.1-1]"
    );
  }
}
