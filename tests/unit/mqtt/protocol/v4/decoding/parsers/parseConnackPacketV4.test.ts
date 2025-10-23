import { PacketType } from "@mqtt/protocol/shared/types";
import { parseConnackPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseConnackPacketV4";
import { IMQTTReaderV4 } from "@mqtt/protocol/v4/types";
import { describe, it, expect } from "vitest";
import { createConnackReaderMock } from "./mocks";
import {
  createConnackFixedHeader,
  createFixedHeader,
} from "tests/helpers/mqtt/protocol/createFixedHeader";

describe("parseConnackPacketV4", () => {
  // commonly used fixed header for CONNACK packet
  const fixedHeader = createConnackFixedHeader(2);

  // commonly used reader mock for CONNACK packet
  const readerMock = {} as unknown as IMQTTReaderV4;

  it(`parse CONNACK packet`, () => {
    const readerMock = createConnackReaderMock(
      2, // remaining
      0x01, // session present flag
      0x05 //connect return code
    );

    const packet = parseConnackPacketV4(fixedHeader, readerMock);

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
      const fixedHeader = createFixedHeader(invalidPacketType, 0b0000, 2);

      expect(() => parseConnackPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet type/
      );
    });
  });

  // Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
  // it is reserved for future use and MUST be set to the value listed in that table
  // [MQTT-2.2.2-1]
  it(`throws an Error for invalid flags`, () => {
    [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80].forEach((invalidFlags) => {
      const fixedHeader = createConnackFixedHeader(2, invalidFlags);

      expect(() => parseConnackPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet flags/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (declared in fixed header)`, () => {
    [0, 1, 3, 4, 5].forEach((invalidRemainingLength) => {
      const fixedHeader = createConnackFixedHeader(invalidRemainingLength);

      expect(() => parseConnackPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet remaining length/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [0, 1, 3, 4].forEach((remaining) => {
      const readerMock = {
        remaining: remaining,
      } as unknown as IMQTTReaderV4;

      expect(() => parseConnackPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid remaining bytes count in reader/
      );
    });
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

      const packet = parseConnackPacketV4(fixedHeader, readerMock);

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

      expect(() => parseConnackPacketV4(fixedHeader, readerMock)).toThrow(
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

      const packet = parseConnackPacketV4(fixedHeader, readerMock);

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

        expect(() => parseConnackPacketV4(fixedHeader, readerMock)).toThrow(
          /Invalid CONNACK return code/
        );
      }
    );
  });
});
