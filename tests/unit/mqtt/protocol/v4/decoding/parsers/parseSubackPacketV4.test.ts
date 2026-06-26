import { PacketType } from "@mqtt/protocol/shared/types";
import {
  IMQTTReaderV4,
  SubackPacketV4,
  SubackReturnCodeV4,
} from "@mqtt/protocol/v4/types";
import { describe, it, expect, vi } from "vitest";
import { createSubackReaderMock } from "./mocks";
import { createSubackFixedHeader } from "@tests/helpers/mqtt/protocol/createFixedHeader";
import { parseMqttPacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parseMqttPacketV4";

describe("parseSubackPacketV4", () => {
  // commonly used fixed header for SUBACK packet
  const fixedHeader = createSubackFixedHeader();

  it(`parse SUBACK packet`, () => {
    const readerMock = createSubackReaderMock(
      [1], // remaining
      0x1234, //identifier
      [0x80] // return code
    );

    const packet = parseMqttPacketV4(fixedHeader, readerMock);

    expect(packet.typeId).toBe(PacketType.SUBACK);
  });

  it("correctly parses Identifier value", () => {
    [1, 255, 260, 4660, 63535].forEach((identifier) => {
      const readerMock = createSubackReaderMock(
        [1], // remaining
        identifier, //identifier
        [0x00] // return code
      );

      const packet = parseMqttPacketV4(
        fixedHeader,
        readerMock
      ) as SubackPacketV4;

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

    expect(() => parseMqttPacketV4(fixedHeader, readerMock)).toThrowError(
      /non-zero/
    );
  });

  it("correctly parses a single Return Code as an array", () => {
    const readerMock = createSubackReaderMock([1], 0x1234, [
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
    ]);

    const packet = parseMqttPacketV4(fixedHeader, readerMock) as SubackPacketV4;

    expect(packet.returnCodeList).toEqual([
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
    ]);
  });

  it("correctly parses multiple Return Codes", () => {
    const readerMock = createSubackReaderMock([4, 3, 2, 1], 0x1234, [
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_2,
      SubackReturnCodeV4.FAILURE,
    ]);

    const packet = parseMqttPacketV4(fixedHeader, readerMock) as SubackPacketV4;

    expect(packet.identifier).toBe(0x1234);
    expect(packet.returnCodeList).toEqual([
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_2,
      SubackReturnCodeV4.FAILURE,
    ]);
  });

  it("correctly parses all valid Return Code values individually", () => {
    [
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_2,
      SubackReturnCodeV4.FAILURE,
    ].forEach((validReturnCode) => {
      const readerMock = createSubackReaderMock([3], 0x1234, [validReturnCode]);

      const packet = parseMqttPacketV4(
        fixedHeader,
        readerMock
      ) as SubackPacketV4;

      expect(packet.returnCodeList).toEqual([validReturnCode]);
    });
  });

  it("throws an Error if any Return Code is invalid", () => {
    [0x03, 0x04, 0x05, 0x7f, 0x81, 0xfe, 0xff].forEach((invalidReturnCode) => {
      const readerMock = createSubackReaderMock([3, 2, 1], 0x1234, [
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
        invalidReturnCode,
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
      ]);

      expect(() => parseMqttPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid SUBACK return code/
      );
    });
  });

  it("throws an Error when SUBACK contains no Return Codes", () => {
    const readerMock = createSubackReaderMock([], 0x1234, []);

    expect(() => parseMqttPacketV4(fixedHeader, readerMock)).toThrow(
      /Invalid return code list length/
    );
  });
});
