import { PacketType } from "@mqtt/protocol/shared/types";
import { ConnackPacketV4, IMQTTReaderV4 } from "@mqtt/protocol/v4/types";
import { describe, it, expect } from "vitest";
import { createConnackReaderMock } from "./mocks";
import { createConnackFixedHeader } from "@tests/helpers/mqtt/protocol/createFixedHeader";
import { parsePacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parsePacketV4";

describe("parseConnackPacketV4", () => {
  // commonly used fixed header for CONNACK packet
  const fixedHeader = createConnackFixedHeader(2);

  it(`parse CONNACK packet`, () => {
    const readerMock = createConnackReaderMock(
      2, // remaining
      0x01, // session present flag
      0x05 //connect return code
    );

    const packet = parsePacketV4(fixedHeader, readerMock);

    expect(packet.typeId).toBe(PacketType.CONNACK);
  });

  it(`correctly parses Session Present Flag`, () => {
    [
      { input: 0x00, expected: false },
      { input: 0x01, expected: true },
    ].forEach(({ input, expected }) => {
      const readerMock = createConnackReaderMock(
        2, // remaining
        input, // session present flag
        0x05 //connect return code
      );

      const packet = parsePacketV4(fixedHeader, readerMock) as ConnackPacketV4;

      expect(packet.sessionPresentFlag).toBe(expected);
    });
  });

  it(`throws an Error for invalid first byte values (Session Present Flag)`, () => {
    [0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0xff].forEach((invalidFirstByte) => {
      const readerMock = createConnackReaderMock(
        2, // remaining
        invalidFirstByte, // session present flag
        0x00 //connect return code
      );

      expect(() => parsePacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid first byte/
      );
    });
  });

  it(`correctly parses all Connect Return Code values`, () => {
    [0x00, 0x01, 0x02, 0x03, 0x04, 0x05].forEach((validReturnCode) => {
      const readerMock = createConnackReaderMock(
        2, // remaining
        0x00, // session present flag
        validReturnCode //connect return code
      );

      const packet = parsePacketV4(fixedHeader, readerMock) as ConnackPacketV4;

      expect(packet.connectReturnCode).toBe(validReturnCode);
    });
  });

  it(`throws an Error for invalid Connect Return Code values`, () => {
    [0x06, 0x07, 0x08, 0x09, 0x0a, 0x7f, 0x80, 0xfe, 0xff].forEach(
      (invalidReturnCode) => {
        const readerMock = createConnackReaderMock(
          2, // remaining
          0x00, // session present flag
          invalidReturnCode //connect return code)
        );

        expect(() => parsePacketV4(fixedHeader, readerMock)).toThrow(
          /Invalid CONNACK return code/
        );
      }
    );
  });
});
