import { PacketType } from "@mqtt/protocol/shared/types";
import { IMQTTReaderV4, SubackPacketV4 } from "@mqtt/protocol/v4/types";
import { describe, it, expect, vi } from "vitest";
import { createSubackReaderMock } from "./mocks";
import { createSubackFixedHeader } from "@tests/helpers/mqtt/protocol/createFixedHeader";
import { parsePacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parsePacketV4";

describe("parseSubackPacketV4", () => {
  // commonly used fixed header for SUBACK packet
  const fixedHeader = createSubackFixedHeader();

  it(`parse SUBACK packet`, () => {
    const readerMock = createSubackReaderMock(
      3, // remaining
      0x1234, //identifier
      0x80 // return code
    );

    const packet = parsePacketV4(fixedHeader, readerMock);

    expect(packet.typeId).toBe(PacketType.SUBACK);
  });

  it("correctly parses Identifier value", () => {
    [1, 255, 260, 4660, 63535].forEach((identifier) => {
      const readerMock = createSubackReaderMock(
        3, // remaining
        identifier, //identifier
        0x00 // return code
      );

      const packet = parsePacketV4(fixedHeader, readerMock) as SubackPacketV4;

      expect(packet.identifier).toBe(identifier);
      expect(readerMock.readTwoByteInteger).toHaveBeenCalledExactlyOnceWith();
      expect(readerMock.readOneByteInteger).toHaveBeenCalledExactlyOnceWith();
    });
  });

  it("throws an Error when Identifier is invalid", () => {
    const readerMock = {
      remaining: 3,
      readTwoByteInteger: vi.fn().mockReturnValue(0),
    } as unknown as IMQTTReaderV4;

    expect(() => parsePacketV4(fixedHeader, readerMock)).toThrowError(
      /non-zero/
    );
  });

  // SUBACK return codes other than 0x00, 0x01, 0x02 and 0x80 are reserved and MUST NOT be used.
  // [MQTT-3.9.3-2]
  it(`correctly parses all Return Code values`, () => {
    [0x00, 0x01, 0x02, 0x80].forEach((validReturnCode) => {
      const readerMock = createSubackReaderMock(
        3, // remaining
        0x1234, //identifier
        validReturnCode // return code
      );

      const packet = parsePacketV4(fixedHeader, readerMock) as SubackPacketV4;

      expect(packet.returnCode).toBe(validReturnCode);
    });
  });

  it(`throws an Error for invalid Return Code values`, () => {
    [0x03, 0x04, 0x05, 0x7f, 0x81, 0xfe, 0xff].forEach((invalidReturnCode) => {
      const readerMock = createSubackReaderMock(
        3, // remaining
        0x1234, //identifier
        invalidReturnCode // return code
      );

      expect(() => parsePacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid SUBACK return code/
      );
    });
  });
});
