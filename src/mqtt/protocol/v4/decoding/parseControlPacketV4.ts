import { FixedHeader, PacketType } from "../../shared/types";
import { MQTTReaderV4 } from "./MQTTReaderV4";
import { AnyPacketV4 } from "../types";

import { parseConnectPacketV4 } from "./parsers/parseConnectPacketV4";
import { parseConnackPacketV4 } from "./parsers/parseConnackPacketV4";
import { parseEmptyPacketV4 } from "./parsers/parseEmptyPacketV4";
import { parsePacketWithIdentifierV4 } from "./parsers/parsePacketWithIdentifierV4";
import { parsePublishPacketV4 } from "./parsers/parsePublishPacketV4";
import { parseSubackPacketV4 } from "./parsers/parseSubackPacketV4";
import { parseSubscribePacketV4 } from "./parsers/parseSubscribePacketV4.";
import { parseUnsubscribePacketV4 } from "./parsers/parseUnsubscribePacketV4";

type Parser = (fixedHeader: FixedHeader, reader: MQTTReaderV4) => AnyPacketV4;

export function parseControlPacketV4(
  fixedHeader: FixedHeader,
  remainingData: Uint8Array
) {
  // TODO: assert (fixedHeader.remainingLength === remainingData.length)

  const reader = new MQTTReaderV4(remainingData);
  const packetType = fixedHeader.packetType;
  const decoder = getParserFor(packetType);

  decoder(fixedHeader, reader);

  // TODO: assert (reader.remaining === 0)
}

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
      throw new Error("Unknown packet type");
  }
}
