import { FixedHeader, PacketType } from "../../../shared/types";
import { AnyPacketV4, IMQTTReaderV4 } from "../../types";
import { parseConnectPacketV4 } from "./parseConnectPacketV4";
import { parseConnackPacketV4 } from "./parseConnackPacketV4";
import { parseEmptyPacketV4 } from "./parseEmptyPacketV4";
import { parsePacketWithIdentifierV4 } from "./parsePacketWithIdentifierV4";
import { parsePublishPacketV4 } from "./parsePublishPacketV4";
import { parseSubackPacketV4 } from "./parseSubackPacketV4";
import { parseSubscribePacketV4 } from "./parseSubscribePacketV4";
import { parseUnsubscribePacketV4 } from "./parseUnsubscribePacketV4";
import { AppError } from "@src/AppError";

type Parser = (fixedHeader: FixedHeader, reader: IMQTTReaderV4) => AnyPacketV4;

/**
 * Parse an MQTT control packet (for protocol version 3.1.1)
 * from the fixed header and remaining data array.
 * @param fixedHeader The fixed header of the MQTT packet.
 * @param remainingData The remaining data of the MQTT packet.
 * @returns The parsed MQTT packet.
 */
export function parseControlPacketV4(
  fixedHeader: FixedHeader,
  remainingData: IMQTTReaderV4
): AnyPacketV4 {
  _assertHasValidRemainingLength(
    fixedHeader.remainingLength,
    remainingData.remaining
  );

  const packetType = fixedHeader.packetType;
  const parser = getParserFor(packetType);

  const packet = parser(fixedHeader, remainingData);

  _assertNoBytesLeftAfterParsingIn(remainingData);

  return packet;
}

/**
 * Get the parser function for the given MQTT packet type.
 * @param packetType The type of the MQTT packet.
 * @returns A parser function that can parse the specified packet type.
 */
export function getParserFor(packetType: PacketType): Parser {
  switch (packetType) {
    case PacketType.CONNECT:
      return parseConnectPacketV4;

    case PacketType.CONNACK:
      return parseConnackPacketV4;

    case PacketType.PUBLISH:
      return parsePublishPacketV4;

    case PacketType.PUBACK:
    case PacketType.PUBREC:
    case PacketType.PUBREL:
    case PacketType.PUBCOMP:
    case PacketType.UNSUBACK:
      return parsePacketWithIdentifierV4;

    case PacketType.SUBSCRIBE:
      return parseSubscribePacketV4;

    case PacketType.SUBACK:
      return parseSubackPacketV4;

    case PacketType.UNSUBSCRIBE:
      return parseUnsubscribePacketV4;

    case PacketType.PINGREQ:
    case PacketType.PINGRESP:
    case PacketType.DISCONNECT:
      return parseEmptyPacketV4;
    default:
      throw new AppError("Unknown packet type");
  }
}

function _assertHasValidRemainingLength(
  inFixedHeader: number,
  inReader: number
) {
  if (inFixedHeader !== inReader)
    throw new AppError(
      `Remaining length declared in fixed header (${inFixedHeader}) does not match actual remaining length (${inReader})`
    );
}

function _assertNoBytesLeftAfterParsingIn(reader: IMQTTReaderV4) {
  if (reader.remaining !== 0)
    throw new AppError("Bytes remain in buffer after parsing");
}
