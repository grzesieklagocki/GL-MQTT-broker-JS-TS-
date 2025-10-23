import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parseSubackPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseSubackPacketV4";
import { createFixedHeader, createSubackFixedHeader } from "tests/helpers/mqtt/protocol/createFixedHeader";
import { describe, it, expect } from "vitest";

//
// integration tests for parseSubackPacketV4 using MQTTReaderV4 with data buffers
//

describe("parseSubackPacketV4", () => {
  const fixedHeader = createSubackFixedHeader();

  it(`parses SUBACK packet`, () => {
    const remainingData = new Uint8Array([0x12, 0x34, 0x80]);
    const reader = new MQTTReaderV4(remainingData);
    const packet = parseSubackPacketV4(fixedHeader, reader);

    expect(packet.typeId).toBe(PacketType.SUBACK);
  });

  it(`throws an Error for other packet types`, () => {
    [
      PacketType.CONNECT,
      PacketType.CONNACK,
      PacketType.PUBLISH,
      PacketType.PUBACK,
      PacketType.PUBREC,
      PacketType.PUBREL,
      PacketType.PUBCOMP,
      PacketType.SUBSCRIBE,
      PacketType.UNSUBSCRIBE,
      PacketType.UNSUBACK,
      PacketType.PINGREQ,
      PacketType.PINGRESP,
      PacketType.DISCONNECT,
    ].forEach((invalidPacketType) => {
      const fixedHeader = createFixedHeader(invalidPacketType, 0b0000, 3);
      const remainingData = new Uint8Array([0x12, 0x34, 0x01]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseSubackPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet type/
      );
    });
  });

  // Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
  // it is reserved for future use and MUST be set to the value listed in that table
  // [MQTT-2.2.2-1]
  it(`throws an Error for invalid flags`, () => {
    [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80].forEach((invalidFlags) => {
      const fixedHeader = createSubackFixedHeader(3, invalidFlags);
      const remainingData = new Uint8Array([0x12, 0x34, 0x02]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseSubackPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet flags/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (declared in fixed header)`, () => {
    [0, 1, 2, 4, 5].forEach((invalidRemainingLength) => {
      const fixedHeader = createSubackFixedHeader(
        invalidRemainingLength,
        0b0000
      );
      const remainingData = new Uint8Array([0x12, 0x34, 0x01]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseSubackPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet remaining length/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [
      [], // empty buffer
      [0xff], // only one byte
      [0x12, 0x23], // two bytes
      [0x12, 0x23, 0x01, 0x77], // four bytes
    ].forEach((array) => {
      const remainingData = new Uint8Array(array);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseSubackPacketV4(fixedHeader, reader)).toThrow(
        /Invalid remaining bytes count in reader/
      );
    });
  });

  it("correctly parses Identifier value", () => {
    [
      { input: [0x00, 0x01, 0x00], expected: 1 },
      { input: [0x00, 0xff, 0x01], expected: 255 },
      { input: [0x01, 0x04, 0x02], expected: 260 },
      { input: [0x12, 0x34, 0x80], expected: 4660 },
      { input: [0xff, 0xff, 0x00], expected: 65535 },
    ].forEach(({ input, expected }) => {
      const remainingData = new Uint8Array(input);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parseSubackPacketV4(fixedHeader, reader);

      expect(packet.identifier).toBe(expected);
    });
  });

  it("correctly parses all Return Code values", () => {
    [
      { input: [0x00, 0x01, 0x00], expected: 0x00 },
      { input: [0x00, 0xff, 0x01], expected: 0x01 },
      { input: [0x01, 0x04, 0x02], expected: 0x02 },
      { input: [0x12, 0x34, 0x80], expected: 0x80 },
    ].forEach(({ input, expected }) => {
      const remainingData = new Uint8Array(input);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parseSubackPacketV4(fixedHeader, reader);

      expect(packet.returnCode).toBe(expected);
    });
  });

  // SUBACK return codes other than 0x00, 0x01, 0x02 and 0x80 are reserved and MUST NOT be used.
  // [MQTT-3.9.3-2]
  it(`throws an Error for invalid Return Code values`, () => {
    [0x03, 0x04, 0x05, 0x7f, 0x81, 0xfe, 0xff].forEach((invalidReturnCode) => {
      const remainingData = new Uint8Array([0x12, 0x34, invalidReturnCode]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseSubackPacketV4(fixedHeader, reader)).toThrow(
        /Invalid SUBACK return code/
      );
    });
  });
});
