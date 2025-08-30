import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parseConnackPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseConnackPacketV4";
import { describe, it, expect } from "vitest";

describe("parseSubackPacketV4", () => {
  it(`parse SUBACK packet`, () => {
    const fixedHeader = {
      packetType: PacketType.CONNACK,
      flags: 0,
      remainingLength: 2,
    };
    const remainingData = new Uint8Array([0x00, 0x00]);
    const reader = new MQTTReaderV4(remainingData);
    const packet = parseConnackPacketV4(fixedHeader, reader);

    expect(packet.typeId).toBe(PacketType.CONNACK);
  });

  it(`throws an Error for other packet types`, () => {
    [
      PacketType.CONNECT,
      PacketType.PUBLISH,
      PacketType.PUBACK,
      PacketType.PUBREC,
      PacketType.PUBREL,
      PacketType.PUBCOMP,
      PacketType.SUBSCRIBE,
      PacketType.SUBACK,
      PacketType.UNSUBSCRIBE,
      PacketType.UNSUBACK,
      PacketType.PINGREQ,
      PacketType.PINGRESP,
      PacketType.DISCONNECT,
    ].forEach((invalidPacketType) => {
      const fixedHeader = {
        packetType: invalidPacketType,
        flags: 0,
        remainingLength: 2,
      };
      const remainingData = new Uint8Array([0x01, 0x00]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseConnackPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet type/
      );
    });
  });

  it(`throws an Error for invalid flags`, () => {
    [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80].forEach((invalidFlags) => {
      const fixedHeader = {
        packetType: PacketType.CONNACK,
        flags: invalidFlags,
        remainingLength: 2,
      };
      const remainingData = new Uint8Array([0x00, 0x01]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseConnackPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet flags/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (declared in fixed header)`, () => {
    [0, 1, 3, 4, 5].forEach((invalidRemainingLength) => {
      const fixedHeader = {
        packetType: PacketType.CONNACK,
        flags: 0,
        remainingLength: invalidRemainingLength,
      };
      const remainingData = new Uint8Array([0x01, 0x00]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseConnackPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet remaining length/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [
      [], // empty buffer
      [0xff], // one byte
      [0x12, 0x23, 0x34], // three bytes
      [0x12, 0x23, 0x01, 0x77], // four bytes
    ].forEach((array) => {
      const fixedHeader = {
        packetType: PacketType.CONNACK,
        flags: 0,
        remainingLength: 2,
      };
      const remainingData = new Uint8Array(array);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseConnackPacketV4(fixedHeader, reader)).toThrow(
        /Invalid remaining bytes count in reader/
      );
    });
  });

  it(`correctly parses Session Present Flag`, () => {
    [
      { input: [0x00, 0x00], expected: false },
      { input: [0x01, 0x00], expected: true },
    ].forEach(({ input, expected }) => {
      const fixedHeader = {
        packetType: PacketType.CONNACK,
        flags: 0,
        remainingLength: 2,
      };
      const remainingData = new Uint8Array(input);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parseConnackPacketV4(fixedHeader, reader);

      expect(packet.sessionPresentFlag).toBe(expected);
    });
  });

  it(`throws an Error for invalid first byte values (Session Present Flag)`, () => {
    [0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0xff].forEach((invalidFirstByte) => {
      const fixedHeader = {
        packetType: PacketType.CONNACK,
        flags: 0,
        remainingLength: 2,
      };
      const remainingData = new Uint8Array([invalidFirstByte, 0x00]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseConnackPacketV4(fixedHeader, reader)).toThrow(
        /Invalid first byte/
      );
    });
  });

  it(`correctly parses all Connect Return Code values`, () => {
    [
      { input: [0x00, 0x00], expected: 0x00 },
      { input: [0x01, 0x01], expected: 0x01 },
      { input: [0x00, 0x02], expected: 0x02 },
      { input: [0x01, 0x03], expected: 0x03 },
      { input: [0x00, 0x04], expected: 0x04 },
      { input: [0x01, 0x05], expected: 0x05 },
    ].forEach(({ input, expected }) => {
      const fixedHeader = {
        packetType: PacketType.CONNACK,
        flags: 0,
        remainingLength: 2,
      };
      const remainingData = new Uint8Array(input);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parseConnackPacketV4(fixedHeader, reader);

      expect(packet.connectReturnCode).toBe(expected);
    });
  });

  it(`throws an Error for invalid Connect Return Code values`, () => {
    [0x06, 0x07, 0x08, 0x09, 0x0a, 0x7f, 0x80, 0xfe, 0xff].forEach(
      (invalidReturnCode) => {
        const fixedHeader = {
          packetType: PacketType.CONNACK,
          flags: 0,
          remainingLength: 2,
        };
        const remainingData = new Uint8Array([0x00, invalidReturnCode]);
        const reader = new MQTTReaderV4(remainingData);

        expect(() => parseConnackPacketV4(fixedHeader, reader)).toThrow(
          /Invalid CONNACK return code/
        );
      }
    );
  });
});
