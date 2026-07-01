import { PacketType } from "../../shared/types";
import { encodeFixedHeaderV4 } from "./encodeFixedHeaderV4";
import { MqttWriterV4 } from "./MqttWriterV4";

/**
 * Combines the fixed header, variable header, and payload into a single MQTT packet for MQTT 3.1.1.
 * @param type Packet type (e.g., CONNECT, PUBLISH, SUBSCRIBE, etc.)
 * @param flags Fixed header flags (specific to the packet type)
 * @param variableHeader Optional variable header as a Uint8Array
 * @param payload Optional payload as a Uint8Array
 * @returns A Uint8Array representing the complete MQTT packet
 */
export function combinePacketV4(
  type: PacketType,
  flags: number,
  variableHeader?: Uint8Array,
  payload?: Uint8Array
): Uint8Array {
  const variableHeaderLength = variableHeader ? variableHeader.length : 0;
  const payloadLength = payload ? payload.length : 0;
  const remainingLength = variableHeaderLength + payloadLength;

  const fixedHeader = encodeFixedHeaderV4({
    packetType: type,
    flags: flags,
    remainingLength: remainingLength,
  });

  const totalPacketLength = fixedHeader.length + remainingLength;
  const writer = new MqttWriterV4(totalPacketLength);

  writer.write(fixedHeader);
  if (variableHeader && variableHeader.length > 0) writer.write(variableHeader);
  if (payload && payload.length > 0) writer.write(payload);

  return writer.toUint8Array();
}
