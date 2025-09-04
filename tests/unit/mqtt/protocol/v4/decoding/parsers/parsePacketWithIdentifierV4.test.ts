import { PacketType } from "@mqtt/protocol/shared/types";
import { parsePacketWithIdentifierV4 } from "@mqtt/protocol/v4/decoding/parsers/parsePacketWithIdentifierV4";
import { IMQTTReaderV4 } from "@src/mqtt/protocol/v4/types";
import { describe, it, expect, vi } from "vitest";

describe("parsePacketWithIdentifierV4", () => {
  const readerMock = {} as unknown as IMQTTReaderV4;

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
      const readerMock = {
        remaining: 2,
        readTwoByteInteger: vi.fn().mockReturnValue(0x1234),
      } as unknown as IMQTTReaderV4;

      const packet = parsePacketWithIdentifierV4(fixedHeader, readerMock);

      expect(packet.typeId).toBe(validPacketType);
      expect(readerMock.readTwoByteInteger).toHaveBeenCalledExactlyOnceWith();
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

      expect(() =>
        parsePacketWithIdentifierV4(fixedHeader, readerMock)
      ).toThrow(/Invalid packet type/);
    });
  });

  it(`throws an Error for invalid flags (for PUBREL)`, () => {
    [0b0000, 0b0001, 0b0011, 0b0100, 0b1000, 0b1010].forEach((invalidFlags) => {
      const fixedHeader = {
        packetType: PacketType.PUBREL,
        flags: invalidFlags,
        remainingLength: 2,
      };

      expect(() =>
        parsePacketWithIdentifierV4(fixedHeader, readerMock)
      ).toThrow(/Invalid packet flags/);
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

          expect(() =>
            parsePacketWithIdentifierV4(fixedHeader, readerMock)
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

      expect(() =>
        parsePacketWithIdentifierV4(fixedHeader, readerMock)
      ).toThrow(/Invalid packet remaining length/);
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [0, 1, 3].forEach((remaining) => {
      const fixedHeader = {
        packetType: PacketType.PUBREL,
        flags: 0b0010,
        remainingLength: 2,
      };

      expect(() =>
        parsePacketWithIdentifierV4(fixedHeader, readerMock)
      ).toThrow(/Invalid remaining bytes count in reader/);
    });
  });

  it("correctly parses Identifier value", () => {
    [1, 255, 260, 4660, 63535].forEach((identifier) => {
      const fixedHeader = {
        packetType: PacketType.PUBACK,
        flags: 0b0000,
        remainingLength: 2,
      };
      const readerMock = {
        remaining: 2,
        readTwoByteInteger: vi.fn().mockReturnValue(identifier),
      } as unknown as IMQTTReaderV4;

      const packet = parsePacketWithIdentifierV4(fixedHeader, readerMock);

      expect(packet.identifier).toBe(identifier);
      expect(readerMock.readTwoByteInteger).toHaveBeenCalledExactlyOnceWith();
    });
  });
});
