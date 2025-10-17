import { PacketType } from "@mqtt/protocol/shared/types";
import { parseSubackPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseSubackPacketV4";
import { IMQTTReaderV4 } from "@src/mqtt/protocol/v4/types";
import { describe, it, expect, vi } from "vitest";
import { createSubackReaderMock } from "./mocks";

describe("parseSubackPacketV4", () => {
  const readerMock = {} as unknown as IMQTTReaderV4;

  it(`parse SUBACK packet`, () => {
    const fixedHeader = {
      packetType: PacketType.SUBACK,
      flags: 0,
      remainingLength: 3,
    };

    const readerMock = createSubackReaderMock(
      3, // remaining
      0x1234, //identifier
      0x80 // return code
    );

    const packet = parseSubackPacketV4(fixedHeader, readerMock);

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
      const fixedHeader = {
        packetType: invalidPacketType,
        flags: 0,
        remainingLength: 2,
      };

      expect(() => parseSubackPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet type/
      );
    });
  });

  // Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
  // it is reserved for future use and MUST be set to the value listed in that table
  // [MQTT-2.2.2-1]
  it(`throws an Error for invalid flags`, () => {
    [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80].forEach((invalidFlags) => {
      const fixedHeader = {
        packetType: PacketType.SUBACK,
        flags: invalidFlags,
        remainingLength: 3,
      };

      expect(() => parseSubackPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet flags/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (declared in fixed header)`, () => {
    [0, 1, 2, 4, 5].forEach((invalidRemainingLength) => {
      const fixedHeader = {
        packetType: PacketType.SUBACK,
        flags: 0x00,
        remainingLength: invalidRemainingLength,
      };

      expect(() => parseSubackPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet remaining length/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [0, 1, 2, 4].forEach((remaining) => {
      const fixedHeader = {
        packetType: PacketType.SUBACK,
        flags: 0x00,
        remainingLength: 3,
      };
      const readerMock = {
        remaining: remaining,
      } as unknown as IMQTTReaderV4;

      expect(() => parseSubackPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid remaining bytes count in reader/
      );
    });
  });

  it("correctly parses Identifier value", () => {
    [1, 255, 260, 4660, 63535].forEach((identifier) => {
      const fixedHeader = {
        packetType: PacketType.SUBACK,
        flags: 0x00,
        remainingLength: 3,
      };

      const readerMock = createSubackReaderMock(
        3, // remaining
        identifier, //identifier
        0x00 // return code
      );

      const packet = parseSubackPacketV4(fixedHeader, readerMock);

      expect(packet.identifier).toBe(identifier);
      expect(readerMock.readTwoByteInteger).toHaveBeenCalledExactlyOnceWith();
      expect(readerMock.readOneByteInteger).toHaveBeenCalledExactlyOnceWith();
    });
  });

  it("throws an Error when Identifier is invalid", () => {
    const fixedHeader = {
      packetType: PacketType.SUBACK,
      flags: 0x00,
      remainingLength: 3,
    };
    const readerMock = {
      remaining: 3,
      readTwoByteInteger: vi.fn().mockReturnValue(0),
    } as unknown as IMQTTReaderV4;

    expect(() => parseSubackPacketV4(fixedHeader, readerMock)).toThrowError(
      /non-zero/
    );
  });

  // SUBACK return codes other than 0x00, 0x01, 0x02 and 0x80 are reserved and MUST NOT be used.
  // [MQTT-3.9.3-2]
  it(`correctly parses all Return Code values`, () => {
    [0x00, 0x01, 0x02, 0x80].forEach((validReturnCode) => {
      const fixedHeader = {
        packetType: PacketType.SUBACK,
        flags: 0x00,
        remainingLength: 3,
      };

      const readerMock = createSubackReaderMock(
        3, // remaining
        0x1234, //identifier
        validReturnCode // return code
      );

      const packet = parseSubackPacketV4(fixedHeader, readerMock);

      expect(packet.returnCode).toBe(validReturnCode);
    });
  });

  it(`throws an Error for invalid Return Code values`, () => {
    [0x03, 0x04, 0x05, 0x7f, 0x81, 0xfe, 0xff].forEach((invalidReturnCode) => {
      const fixedHeader = {
        packetType: PacketType.SUBACK,
        flags: 0x00,
        remainingLength: 3,
      };

      const readerMock = createSubackReaderMock(
        3, // remaining
        0x1234, //identifier
        invalidReturnCode // return code
      );

      expect(() => parseSubackPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid SUBACK return code/
      );
    });
  });
});
