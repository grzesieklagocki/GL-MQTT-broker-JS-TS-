import { PacketType } from "@mqtt/protocol/shared/types";
import { parseEmptyPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseEmptyPacketV4";
import { IMQTTReaderV4 } from "@src/mqtt/protocol/v4/types";
import { describe, it, expect } from "vitest";

describe("parseEmptyPacketV4", () => {
  const readerMock = {} as unknown as IMQTTReaderV4;

  it(`parse PINGREQ, PINGRESP and DISCONNECT packets`, () => {
    [PacketType.PINGREQ, PacketType.PINGRESP, PacketType.DISCONNECT].forEach(
      (validPacketType) => {
        const fixedHeader = {
          packetType: validPacketType,
          flags: 0x00,
          remainingLength: 0,
        };
        const readerMock = { remaining: 0 } as unknown as IMQTTReaderV4;

        const packet = parseEmptyPacketV4(fixedHeader, readerMock);

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
      expect(() => parseEmptyPacketV4(fixedHeader, readerMock)).toThrow(
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

      expect(() => parseEmptyPacketV4(fixedHeader, readerMock)).toThrow(
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

      expect(() => parseEmptyPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet remaining length/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [1, 2, 3].forEach((remaining) => {
      const fixedHeader = {
        packetType: PacketType.DISCONNECT,
        flags: 0x00,
        remainingLength: 0,
      };

      const readerMock = { remaining: remaining } as unknown as IMQTTReaderV4;

      expect(() => parseEmptyPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid remaining bytes count in reader/
      );
    });
  });
});
