import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parseEmptyPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseEmptyPacketV4";
import { describe, it, expect } from "vitest";

describe("parseEmptyPacketV4", () => {
  it(`parse PINGREQ, PINGRESP and DISCONNECT packets`, () => {
    [PacketType.PINGREQ, PacketType.PINGRESP, PacketType.DISCONNECT].forEach(
      (validPacketType) => {
        const fixedHeader = {
          packetType: validPacketType,
          flags: 0x00,
          remainingLength: 0,
        };
        const remainingData = new Uint8Array();
        const reader = new MQTTReaderV4(remainingData);
        const packet = parseEmptyPacketV4(fixedHeader, reader);

        expect(packet.typeId).toBe(validPacketType);
      }
    );
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
      PacketType.SUBACK,
      PacketType.UNSUBSCRIBE,
      PacketType.UNSUBACK,
    ].forEach((invalidPacketType) => {
      const fixedHeader = {
        packetType: invalidPacketType,
        flags: 0x00,
        remainingLength: 0,
      };
      const remainingData = new Uint8Array();
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseEmptyPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet type/
      );
    });
  });

  it(`throws an Error for invalid flags`, () => {
    [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80].forEach((invalidFlags) => {
      const fixedHeader = {
        packetType: PacketType.PINGREQ,
        flags: invalidFlags,
        remainingLength: 0,
      };
      const remainingData = new Uint8Array();
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseEmptyPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet flags/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (declared in fixed header)`, () => {
    [1, 2, 3, 4, 5].forEach((invalidRemainingLength) => {
      const fixedHeader = {
        packetType: PacketType.PINGRESP,
        flags: 0x00,
        remainingLength: invalidRemainingLength,
      };
      const remainingData = new Uint8Array([0x12, 0x34]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseEmptyPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet remaining length/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [
      [0xff], // one byte
      [0xc1, 0x0a], // two bytes
      [0x12, 0x23, 0x34], // three bytes
    ].forEach((array) => {
      const fixedHeader = {
        packetType: PacketType.DISCONNECT,
        flags: 0x00,
        remainingLength: 0,
      };
      const remainingData = new Uint8Array(array);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseEmptyPacketV4(fixedHeader, reader)).toThrow(
        /Invalid remaining bytes count in reader/
      );
    });
  });
});
