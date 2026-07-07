import { PacketType } from "../../shared/types";
import { AnyPacketV4, PublishFlagsV4 } from "../types";
import { _assertValidConnectPacketV4 } from "../validation/connect";
import { combinePacketV4 } from "./combinePacketV4";
import { encodePayloadV4 } from "./encodePayloadV4";
import { encodeVariableHeaderV4 } from "./encodeVariableHeaderV4";

/**
 * Encodes an MQTT packet into a Uint8Array.
 * @param packet - The MQTT packet to encode.
 * @returns A Uint8Array representing the encoded MQTT packet.
 */
export function encodeMqttPacketV4(packet: AnyPacketV4): Uint8Array {
  if (packet.typeId === PacketType.CONNECT)
    _assertValidConnectPacketV4(packet.flags, packet.payload);

  const variableHeader = encodeVariableHeaderV4(packet);
  const payload = encodePayloadV4(packet);

  // [MQTT-3.14.1-1]
  // The Server MUST validate that reserved bits are set to zero and disconnect the Client if they are not zero.
  let flags = 0b0000;

  switch (packet.typeId) {
    case PacketType.PUBLISH:
      flags = flagsToNumber(packet.flags);
      break;

    // [MQTT-3.6.1-1]
    // Bits 3,2,1 and 0 of the fixed header in the PUBREL Control Packet are reserved and MUST be set to 0,0,1 and 0 respectively.
    case PacketType.PUBREL:
    // [MQTT-3.8.1-1]
    // Bits 3,2,1 and 0 of the fixed header of the SUBSCRIBE Control Packet are reserved and MUST be set to 0,0,1 and 0 respectively.
    case PacketType.SUBSCRIBE:
    // [MQTT-3.10.1-1]
    // Bits 3,2,1 and 0 of the fixed header of the UNSUBSCRIBE Control Packet are reserved and MUST be set to 0,0,1 and 0 respectively.
    case PacketType.UNSUBSCRIBE:
      flags = 0b0010;
      break;
  }

  return combinePacketV4(packet.typeId, flags, variableHeader, payload);
}

/**
 * Converts the PublishFlagsV4 object into a number representing the flags for the fixed header of a PUBLISH packet.
 * @param flags - The PublishFlagsV4 object containing the DUP, QoS, and RETAIN flags.
 * @returns A number representing the encoded flags for the fixed header of a PUBLISH packet.
 */
const flagsToNumber = (flags: PublishFlagsV4) => {
  const dup = flags.dup ? 1 : 0;
  const qos = flags.qosLevel;
  const retain = flags.retain ? 1 : 0;

  return (dup << 3) | (qos << 1) | retain;
};
