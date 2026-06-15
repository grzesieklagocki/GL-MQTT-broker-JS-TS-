import { BinaryBuffer } from "@mqtt/protocol/shared/BinaryBuffer";
import { PacketType } from "@mqtt/protocol/shared/types";
import { MqttPacketFramer } from "@src/mqtt/protocol/shared/MqttPacketFramer";
import { FixedHeaderParserV4 } from "@mqtt/protocol/v4/decoding/parsers/FixedHeaderParserV4";
import { beforeEach, describe, expect, it } from "vitest";

// Integration tests for MQTTPacketFramer with BinaryBuffer and FixedHeaderParserV4
describe("MQTTPacketFramer with BinaryBuffer and FixedHeaderParserV4", () => {
  let framer = createMqttPacketFramer();

  beforeEach(() => {
    framer = createMqttPacketFramer();
  });

  it("should frame PINGREQ packet", () => {
    framer.write(new Uint8Array([0xc0, 0x00]));

    expect(framer.hasPacket).toBe(true);

    const [fixedHeader, restOfPacket] = framer.readPacket();

    expect(fixedHeader).toEqual({
      packetType: PacketType.PINGREQ,
      flags: 0,
      remainingLength: 0,
    });

    expect(restOfPacket).toBeUndefined();
  });

  it("should not frame packet with incomplete remaining length", () => {
    framer.write(new Uint8Array([0x30, 0x80]));

    expect(framer.hasPacket).toBe(false);
  });

  it("should frame packet split across multiple writes", () => {
    framer.write(new Uint8Array([0x30]));
    expect(framer.hasPacket).toBe(false);

    framer.write(new Uint8Array([0x05]));
    expect(framer.hasPacket).toBe(false);

    framer.write(new Uint8Array([0x00, 0x01]));
    expect(framer.hasPacket).toBe(false);

    framer.write(new Uint8Array([0x61, 0x10, 0x20]));
    expect(framer.hasPacket).toBe(true);

    const [fixedHeader, rest] = framer.readPacket();

    expect(fixedHeader.packetType).toBe(PacketType.PUBLISH);
    expect(fixedHeader.flags).toBe(0);
    expect(fixedHeader.remainingLength).toBe(5);
    expect([...(rest as Uint8Array)]).toEqual([0x00, 0x01, 0x61, 0x10, 0x20]);
  });

  it("should frame multiple packets from one write", () => {
    framer.write(
      new Uint8Array([
        // PINGREQ
        0xc0, 0x00,
        // DISCONNECT
        0xe0, 0x00,
      ])
    );

    expect(framer.hasPacket).toBe(true);

    const [first] = framer.readPacket();
    expect(first.packetType).toBe(PacketType.PINGREQ);

    expect(framer.hasPacket).toBe(true);

    const [second] = framer.readPacket();
    expect(second.packetType).toBe(PacketType.DISCONNECT);

    expect(framer.hasPacket).toBe(false);
  });

  it("should frame packet with multi-byte remaining length", () => {
    const payload = new Uint8Array(128).fill(0xaa);

    framer.write(new Uint8Array([0x30, 0x80, 0x01]));
    framer.write(payload);

    expect(framer.hasPacket).toBe(true);

    const [fixedHeader, rest] = framer.readPacket();

    expect(fixedHeader.packetType).toBe(PacketType.PUBLISH);
    expect(fixedHeader.remainingLength).toBe(128);
    expect(rest?.length).toBe(128);
  });

  it("should throw for malformed remaining length encoded in more than 4 bytes", () => {
    framer.write(new Uint8Array([0x30, 0x80, 0x80, 0x80, 0x80, 0x00]));

    expect(() => framer.hasPacket).toThrow();
  });
});

// Helpers

const createMqttPacketFramer = () =>
  new MqttPacketFramer(new BinaryBuffer(), new FixedHeaderParserV4());
