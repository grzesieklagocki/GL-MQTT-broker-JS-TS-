import { PacketType } from "@mqtt/protocol/shared/types";
import { parsePacketWithIdentifierV4 } from "@mqtt/protocol/v4/decoding/parsers/parsePacketWithIdentifierV4";
import { IMQTTReaderV4 } from "@mqtt/protocol/v4/types";
import { createPacketWithIdentifierFixedHeader } from "tests/helpers/mqtt/protocol/createFixedHeader";
import { describe, it, expect, vi } from "vitest";

describe("parsePacketWithIdentifierV4", () => {
  // commonly used reader mock
  const readerMock = {} as unknown as IMQTTReaderV4;

  it(`parse PUBACK, PUBREC, PUBREL, PUBCOMP and UNSUBACK packets`, () => {
    [
      PacketType.PUBACK,
      PacketType.PUBREC,
      PacketType.PUBREL,
      PacketType.PUBCOMP,
      PacketType.UNSUBACK,
    ].forEach((validPacketType) => {
      const fixedHeader = createPacketWithIdentifierFixedHeader(
        validPacketType,
        validPacketType === PacketType.PUBREL ? 0b0010 : 0b0000
      );
      const readerMock = {
        remaining: 2,
        readTwoByteInteger: vi.fn().mockReturnValue(0x1234),
      } as unknown as IMQTTReaderV4;

      const packet = parsePacketWithIdentifierV4(fixedHeader, readerMock);

      expect(packet.typeId).toBe(validPacketType);
      expect(readerMock.readTwoByteInteger).toHaveBeenCalledExactlyOnceWith();
    });
  });

  // Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
  // it is reserved for future use and MUST be set to the value listed in that table
  // [MQTT-2.2.2-1]
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
      const fixedHeader =
        createPacketWithIdentifierFixedHeader(invalidPacketType);

      expect(() =>
        parsePacketWithIdentifierV4(fixedHeader, readerMock)
      ).toThrow(/Invalid packet type/);
    });
  });

  it("correctly parses Identifier value", () => {
    [1, 255, 260, 4660, 63535].forEach((identifier) => {
      const fixedHeader = createPacketWithIdentifierFixedHeader(
        PacketType.PUBACK
      );
      const readerMock = {
        remaining: 2,
        readTwoByteInteger: vi.fn().mockReturnValue(identifier),
      } as unknown as IMQTTReaderV4;

      const packet = parsePacketWithIdentifierV4(fixedHeader, readerMock);

      expect(packet.identifier).toBe(identifier);
      expect(readerMock.readTwoByteInteger).toHaveBeenCalledExactlyOnceWith();
    });
  });

  it("throws an Error when Identifier is invalid", () => {
    const fixedHeader = createPacketWithIdentifierFixedHeader(
      PacketType.PUBACK
    );
    const readerMock = {
      remaining: 2,
      readTwoByteInteger: vi.fn().mockReturnValue(0),
    } as unknown as IMQTTReaderV4;

    expect(() =>
      parsePacketWithIdentifierV4(fixedHeader, readerMock)
    ).toThrowError(/non-zero/);
  });
});
