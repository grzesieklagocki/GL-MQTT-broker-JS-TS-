import { IMQTTReaderV4 } from "../../types";
import { _assertValidIdentifier } from "../../validation/identifier";

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
