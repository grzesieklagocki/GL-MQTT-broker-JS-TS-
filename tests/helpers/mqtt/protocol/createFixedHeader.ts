import { FixedHeader, PacketType } from "@mqtt/protocol/shared/types";

export function createFixedHeader(
  packetType: PacketType,
  flags: number,
  remainingLength: number
): FixedHeader {
  return {
    packetType: packetType,
    flags: flags,
    remainingLength: remainingLength,
  };
}

export const createConnackFixedHeader = (
  length: number,
  flags: number = 0b0000
) => createFixedHeader(PacketType.CONNACK, flags, length);

export const createConnectFixedHeader = (
  length: number,
  flags: number = 0b0000
) => createFixedHeader(PacketType.CONNECT, flags, length);

export const createEmptyPacketFixedHeader = (
  type: PacketType,
  flags: number = 0b0000,
  length: number = 0
) => createFixedHeader(type, flags, length);

export const createPacketWithIdentifierFixedHeader = (
  type: PacketType,
  flags: number = 0b0000,
  length: number = 2
) => createFixedHeader(type, flags, length);

export const createPublishFixedHeader = (
  length: number,
  flags: number = 0b0000
) => createFixedHeader(PacketType.PUBLISH, flags, length);

export const createSubackFixedHeader = (
  length: number = 3,
  flags: number = 0b0000
) => createFixedHeader(PacketType.SUBACK, flags, length);

export const createSubscribeFixedHeader = (
  length: number,
  flags: number = 0b0010
) => createFixedHeader(PacketType.SUBSCRIBE, flags, length);

export const createUnsubscribeFixedHeader = (
  length: number,
  flags: number = 0b0010
) => createFixedHeader(PacketType.UNSUBSCRIBE, flags, length);
