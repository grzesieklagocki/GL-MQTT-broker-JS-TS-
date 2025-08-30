import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parsePacketWithIdentifierV4 } from "@mqtt/protocol/v4/decoding/parsers/parsePacketWithIdentifierV4";
import { describe, it, expect } from "vitest";

describe("parsePacketWithIdentifierV4", () => {
  it(`parse PUBACK, PUBREC, PUBREL, PUBCOMP and UNSUBACK packets`, () => {
    [
      PacketType.PUBACK,
      PacketType.PUBREC,
      PacketType.PUBREL,
      PacketType.PUBCOMP,
      PacketType.UNSUBACK,
    ].forEach((validPacketType) => {
      const fixedHeader = {
        packetType: validPacketType,
        flags: validPacketType === PacketType.PUBREL ? 0b0010 : 0b0000,
        remainingLength: 2,
      };
      const remainingData = new Uint8Array([0x12, 0x34]);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parsePacketWithIdentifierV4(fixedHeader, reader);

      expect(packet.typeId).toBe(validPacketType);
    });
  });

  it(`throws an Error for other packet types`, () => {
    [
      PacketType.CONNECT,
      PacketType.CONNACK,
      PacketType.PUBLISH,
      PacketType.SUBSCRIBE,
      PacketType.SUBACK,
      PacketType.UNSUBSCRIBE,
      PacketType.PINGREQ,
      PacketType.PINGRESP,
      PacketType.DISCONNECT,
    ].forEach((invalidPacketType) => {
      const fixedHeader = {
        packetType: invalidPacketType,
        flags: 0b0000,
        remainingLength: 2,
      };
      const remainingData = new Uint8Array([0x12, 0x34]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parsePacketWithIdentifierV4(fixedHeader, reader)).toThrow(
        /Invalid packet type/
      );
    });
  });

  it(`throws an Error for invalid flags (for PUBREL)`, () => {
    [0b0000, 0b0001, 0b0011, 0b0100, 0b1000, 0b1010].forEach((invalidFlags) => {
      const fixedHeader = {
        packetType: PacketType.PUBREL,
        flags: invalidFlags,
        remainingLength: 2,
      };
      const remainingData = new Uint8Array([0x12, 0x34]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parsePacketWithIdentifierV4(fixedHeader, reader)).toThrow(
        /Invalid packet flags/
      );
    });
  });

  it(`throws an Error for invalid flags (for other packet types)`, () => {
    [
      PacketType.PUBACK,
      PacketType.PUBREC,
      PacketType.PUBCOMP,
      PacketType.UNSUBACK,
    ].forEach((packetType) => {
      [0b0001, 0b0010, 0b0011, 0b0100, 0b1000, 0b1010].forEach(
        (invalidFlags) => {
          const fixedHeader = {
            packetType,
            flags: invalidFlags,
            remainingLength: 2,
          };
          const remainingData = new Uint8Array([0x12, 0x34]);
          const reader = new MQTTReaderV4(remainingData);

          expect(() =>
            parsePacketWithIdentifierV4(fixedHeader, reader)
          ).toThrow(/Invalid packet flags/);
        }
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (declared in fixed header)`, () => {
    [0, 1, 3, 4, 5].forEach((invalidRemainingLength) => {
      const fixedHeader = {
        packetType: PacketType.PUBREC,
        flags: 0b0000,
        remainingLength: invalidRemainingLength,
      };
      const remainingData = new Uint8Array([0x12, 0x34]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parsePacketWithIdentifierV4(fixedHeader, reader)).toThrow(
        /Invalid packet remaining length/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [
      [], // empty buffer
      [0xff], // only one byte
      [0x12, 0x23, 0x34], // three bytes
    ].forEach((array) => {
      const fixedHeader = {
        packetType: PacketType.PUBREL,
        flags: 0b0010,
        remainingLength: 2,
      };
      const remainingData = new Uint8Array(array);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parsePacketWithIdentifierV4(fixedHeader, reader)).toThrow(
        /Invalid remaining bytes count in reader/
      );
    });
  });

  it("correctly parses Identifier value", () => {
    [
      { input: [0x00, 0x01], expected: 1 },
      { input: [0x00, 0xff], expected: 255 },
      { input: [0x01, 0x04], expected: 260 },
      { input: [0x12, 0x34], expected: 4660 },
      { input: [0xff, 0xff], expected: 65535 },
    ].forEach(({ input, expected }) => {
      const fixedHeader = {
        packetType: PacketType.PUBACK,
        flags: 0b0000,
        remainingLength: 2,
      };
      const remainingData = new Uint8Array(input);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parsePacketWithIdentifierV4(fixedHeader, reader);

      expect(packet.identifier).toBe(expected);
    });
  });
});
