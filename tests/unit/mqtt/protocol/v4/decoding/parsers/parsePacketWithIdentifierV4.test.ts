import { PacketType, PacketWithIdentifier } from "@mqtt/protocol/shared/types";
import { IMQTTReaderV4 } from "@mqtt/protocol/v4/types";
import { parsePacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parsePacketV4";
import { createPacketWithIdentifierFixedHeader } from "@tests/helpers/mqtt/protocol/createFixedHeader";
import { describe, it, expect, vi } from "vitest";

describe("parsePacketWithIdentifierV4", () => {
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

      const packet = parsePacketV4(fixedHeader, readerMock);

      expect(packet.typeId).toBe(validPacketType);
      expect(readerMock.readTwoByteInteger).toHaveBeenCalledExactlyOnceWith();
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

      const packet = parsePacketV4(
        fixedHeader,
        readerMock
      ) as PacketWithIdentifier<PacketType.PUBACK>;

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

    expect(() => parsePacketV4(fixedHeader, readerMock)).toThrowError(
      /non-zero/
    );
  });
});
