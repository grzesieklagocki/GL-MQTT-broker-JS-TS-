import { PacketType } from "../../shared/types";
import { AnyPacketV4, PublishFlagsV4 } from "../types";
import { combinePacketV4 } from "./combinePacketV4";
import { encodePayloadV4 } from "./encodePayloadV4";
import { encodeVariableHeaderV4 } from "./encodeVariableHeaderV4";

/**
 * Encodes an MQTT packet into a Uint8Array.
 * @param packet - The MQTT packet to encode.
 * @returns A Uint8Array representing the encoded MQTT packet.
 */
export function encodeMqttPacketV4(packet: AnyPacketV4): Uint8Array {
  const variableHeader = encodeVariableHeaderV4(packet);
  const payload = encodePayloadV4(packet);

  let flags = 0b0000;

  switch (packet.typeId) {
    case PacketType.PUBLISH:
      flags = flagsToNumber(packet.flags);
      break;
    case PacketType.PUBREL:
    case PacketType.UNSUBSCRIBE:
    case PacketType.SUBSCRIBE:
      flags = 0b0010;
      break;
  }

  return combinePacketV4(packet.typeId, flags, variableHeader, payload);
}

const flagsToNumber = (flags: PublishFlagsV4) => {
  const dup = flags.dup ? 1 : 0;
  const qos = flags.qosLevel;
  const retain = flags.retain ? 1 : 0;

  return (dup << 3) | (qos << 1) | retain;
};
