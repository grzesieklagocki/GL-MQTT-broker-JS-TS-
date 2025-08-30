import { FixedHeader, PacketType } from "@mqtt/protocol/shared/types";
import { parseControlPacketV4 } from "@mqtt/protocol/v4/decoding/parseControlPacketV4";
import {
  ConnackPacketV4,
  DisconnectPacketV4,
  PubackPacketV4,
  SubackPacketV4,
} from "@src/mqtt/protocol/v4/types";
import { describe, expect, it } from "vitest";

describe("parseControlPacketV4", () => {
  it("parse an empty control packet", () => {
    const fixedHeader: FixedHeader = {
      packetType: PacketType.DISCONNECT,
      flags: 0,
      remainingLength: 0,
    };
    const remainingData = new Uint8Array();

    const packet = parseControlPacketV4(
      fixedHeader,
      remainingData
    ) as DisconnectPacketV4;

    expect(packet.typeId).toBe(PacketType.DISCONNECT);
  });
  it("parse a control packet with identifier", () => {
    const fixedHeader: FixedHeader = {
      packetType: PacketType.PUBACK,
      flags: 0,
      remainingLength: 2,
    };
    const remainingData = new Uint8Array([0x01, 0x04]);

    const packet = parseControlPacketV4(
      fixedHeader,
      remainingData
    ) as PubackPacketV4;

    expect(packet.typeId).toBe(PacketType.PUBACK);
    expect(packet.identifier).toBe(260);
  });
  it("parse SUBACK control packet", () => {
    const fixedHeader: FixedHeader = {
      packetType: PacketType.SUBACK,
      flags: 0,
      remainingLength: 3,
    };
    const remainingData = new Uint8Array([0x02, 0x10, 0x02]);

    const packet = parseControlPacketV4(
      fixedHeader,
      remainingData
    ) as SubackPacketV4;

    expect(packet.typeId).toBe(PacketType.SUBACK);
    expect(packet.returnCode).toBe(0x02);
    expect(packet.identifier).toBe(0x0210);
  });
  it("parse CONNACK control packet", () => {
    const fixedHeader: FixedHeader = {
      packetType: PacketType.CONNACK,
      flags: 0,
      remainingLength: 2,
    };
    const remainingData = new Uint8Array([0x01, 0x04]);

    const packet = parseControlPacketV4(
      fixedHeader,
      remainingData
    ) as ConnackPacketV4;

    expect(packet.typeId).toBe(PacketType.CONNACK);
    expect(packet.sessionPresentFlag).toBe(true);
    expect(packet.connectReturnCode).toBe(0x04);
  });
  it("parse CONNACK control packet", () => {
    const fixedHeader: FixedHeader = {
      packetType: PacketType.CONNACK,
      flags: 0,
      remainingLength: 2,
    };
    const remainingData = new Uint8Array([0x01, 0x04]);

    const packet = parseControlPacketV4(
      fixedHeader,
      remainingData
    ) as ConnackPacketV4;

    expect(packet.typeId).toBe(PacketType.CONNACK);
    expect(packet.sessionPresentFlag).toBe(true);
    expect(packet.connectReturnCode).toBe(0x04);
  });
  it("throws an Error CONNACK control packet", () => {
    const fixedHeader: FixedHeader = {
      packetType: PacketType.CONNACK,
      flags: 0,
      remainingLength: 2,
    };
    const remainingData = new Uint8Array([0x00, 0x06]);

    expect(() => parseControlPacketV4(fixedHeader, remainingData)).toThrow();
  });
});
