import { describe, expect, it } from "vitest";
import { PacketType } from "@src/mqtt/protocol/shared/types";
import { combinePacketV4 } from "@src/mqtt/protocol/v4/encoding/combinePacketV4";

const expectBytes = (actual: Uint8Array, expected: number[]) => {
  expect([...actual]).toEqual(expected);
};

describe("combinePacketV4", () => {
  it("should combine fixed header and variable header without payload", () => {
    const variableHeader = new Uint8Array([0x12, 0x34]); // Packet Identifier

    const result = combinePacketV4(PacketType.PUBACK, 0, variableHeader);

    expectBytes(result, [
      0x40, // PUBACK, flags 0000
      0x02, // Remaining Length = 2
      0x12,
      0x34,
    ]);
  });

  it("should combine fixed header, variable header and payload", () => {
    const variableHeader = new Uint8Array([
      0x00,
      0x01,
      0x61, // Topic Name: "a"
    ]);

    const payload = new Uint8Array([0x10, 0x20]);

    const result = combinePacketV4(
      PacketType.PUBLISH,
      0,
      variableHeader,
      payload
    );

    expectBytes(result, [
      0x30, // PUBLISH, flags 0000
      0x05, // Remaining Length = 3 + 2

      // Variable Header
      0x00,
      0x01,
      0x61,

      // Payload
      0x10,
      0x20,
    ]);
  });

  it("should encode packet with empty variable header and no payload", () => {
    const result = combinePacketV4(PacketType.PINGREQ, 0, new Uint8Array());

    expectBytes(result, [
      0xc0, // PINGREQ
      0x00, // Remaining Length = 0
    ]);
  });

  it("should treat undefined payload as zero-length payload", () => {
    const variableHeader = new Uint8Array([0x12, 0x34]);

    const result = combinePacketV4(
      PacketType.PUBREC,
      0,
      variableHeader,
      undefined
    );

    expectBytes(result, [
      0x50, // PUBREC
      0x02,
      0x12,
      0x34,
    ]);
  });

  it("should handle empty payload", () => {
    const variableHeader = new Uint8Array([
      0x00,
      0x01,
      0x61, // Topic Name: "a"
    ]);

    const payload = new Uint8Array([]);

    const result = combinePacketV4(
      PacketType.PUBLISH,
      0b0001, // RETAIN
      variableHeader,
      payload
    );

    expectBytes(result, [
      0x31, // PUBLISH, RETAIN=1
      0x03, // Remaining Length = variableHeader.length only

      0x00,
      0x01,
      0x61,
    ]);
  });

  it("should preserve byte order: fixed header, variable header, payload", () => {
    const variableHeader = new Uint8Array([0xaa, 0xbb]);
    const payload = new Uint8Array([0xcc, 0xdd]);

    const result = combinePacketV4(
      PacketType.PUBLISH,
      0,
      variableHeader,
      payload
    );

    expectBytes(result, [0x30, 0x04, 0xaa, 0xbb, 0xcc, 0xdd]);
  });

  it("should encode Remaining Length using multiple bytes when body length is 128", () => {
    const variableHeader = new Uint8Array([
      0x00,
      0x01,
      0x61, // Topic Name: "a", length = 3
    ]);

    const payload = new Uint8Array(125).fill(0xaa);
    // variableHeader.length = 3
    // payload.length = 125
    // remainingLength = 128

    const result = combinePacketV4(
      PacketType.PUBLISH,
      0,
      variableHeader,
      payload
    );

    expect(result[0]).toBe(0x30);
    expect(result[1]).toBe(0x80);
    expect(result[2]).toBe(0x01);
    expect(result.length).toBe(3 + 128);

    expect([...result.slice(3, 6)]).toEqual([0x00, 0x01, 0x61]);
  });

  it("should encode Remaining Length = 127 using one byte", () => {
    const variableHeader = new Uint8Array([0x00, 0x01, 0x61]);

    const payload = new Uint8Array(124).fill(0xaa);
    // 3 + 124 = 127

    const result = combinePacketV4(
      PacketType.PUBLISH,
      0,
      variableHeader,
      payload
    );

    expect(result[0]).toBe(0x30);
    expect(result[1]).toBe(0x7f);
    expect(result.length).toBe(2 + 127);
  });

  it("should encode Remaining Length = 16384 using three bytes", () => {
    const variableHeader = new Uint8Array([0x00, 0x01, 0x61]);

    const payload = new Uint8Array(16381).fill(0xaa);
    // 3 + 16381 = 16384

    const result = combinePacketV4(
      PacketType.PUBLISH,
      0,
      variableHeader,
      payload
    );

    expect(result[0]).toBe(0x30);
    expect(result[1]).toBe(0x80);
    expect(result[2]).toBe(0x80);
    expect(result[3]).toBe(0x01);
    expect(result.length).toBe(4 + 16384);
  });

  it("should propagate validation error for invalid fixed header flags", () => {
    const variableHeader = new Uint8Array([0x12, 0x34]);

    expect(() =>
      combinePacketV4(
        PacketType.PUBACK,
        0b0010, // PUBACK must have flags 0000
        variableHeader
      )
    ).toThrow();
  });

  it("should propagate validation error for invalid PUBLISH QoS flags", () => {
    const variableHeader = new Uint8Array([0x00, 0x01, 0x61]);

    expect(() =>
      combinePacketV4(
        PacketType.PUBLISH,
        0b0110, // QoS bits = 11, invalid
        variableHeader
      )
    ).toThrow();
  });

  it("should propagate validation error when empty packet has non-zero remaining length", () => {
    const variableHeader = new Uint8Array([0x00]);

    expect(() =>
      combinePacketV4(PacketType.PINGREQ, 0, variableHeader)
    ).toThrow();
  });
});
