import { FixedHeader, PacketType } from "@src/mqtt/protocol/shared/types";
import { AnyPacketV4, IMQTTReaderV4 } from "../../types";
import { AppError } from "@src/AppError";
import { parseConnackPacketV4 } from "./parseConnackPacketV4";
import { parseConnectPacketV4 } from "./parseConnectPacketV4";
import { parsePublishPacketV4 } from "./parsePublishPacketV4";
import { parseSubscribePacketV4 } from "./parseSubscribePacketV4";
import { parseUnsubscribePacketV4 } from "./parseUnsubscribePacketV4";
import { parseSubackPacketV4 } from "./parseSubackPacketV4";
import { parseIdentifier } from "./parseIdentifier";

/**
 * Parses MQTT packet from the given fixed header and reader.
 * @param fixedHeader - The fixed header of the MQTT packet.
 * @param reader - The reader to read the variable header and payload of the MQTT packet.
 * @returns The parsed MQTT packet as an AnyPacketV4.
 */
export function parseMqttPacketV4(
  fixedHeader: FixedHeader,
  reader?: IMQTTReaderV4
): AnyPacketV4 {
  const packetType = fixedHeader.packetType;
  const packet = { typeId: fixedHeader.packetType };

  switch (packetType) {
    // handle packets without variable header and payload
    case PacketType.PINGREQ:
    case PacketType.PINGRESP:
    case PacketType.DISCONNECT:
      return packet as AnyPacketV4;
  }

  if (reader === undefined)
    throw new AppError(
      `Reader is required for this packet type: ${PacketType[packetType]}`
    );

  switch (packetType) {
    // for CONNECT, CONNACK and PUBLISH (QoS=0)
    // the packet identifier is not present
    // handle it before parsing the identifier
    case PacketType.CONNECT:
      return parseConnectPacketV4(fixedHeader, reader);
    case PacketType.CONNACK:
      return parseConnackPacketV4(fixedHeader, reader);
    case PacketType.PUBLISH:
      return parsePublishPacketV4(fixedHeader, reader);
  }

  const identifier = parseIdentifier(reader);

  switch (packetType) {
    // handle packets with identifier but no payload (PUBACK, PUBREC, PUBREL, PUBCOMP, UNSUBACK)
    case PacketType.PUBACK:
    case PacketType.PUBREC:
    case PacketType.PUBREL:
    case PacketType.PUBCOMP:
    case PacketType.UNSUBACK:
      return { typeId: packetType, identifier };

    // handle packets with identifier and payload (SUBSCRIBE, SUBACK, UNSUBSCRIBE)
    case PacketType.SUBSCRIBE:
      return parseSubscribePacketV4(identifier, reader);
    case PacketType.SUBACK:
      return parseSubackPacketV4(identifier, reader);
    case PacketType.UNSUBSCRIBE:
      return parseUnsubscribePacketV4(identifier, reader);
    default:
      throw new AppError(
        `Unsupported packet type: ${PacketType[packetType]} for protocol version 4 (MQTT 3.1.1)`
      );
  }
}
