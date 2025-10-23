import { PacketType } from "@mqtt/protocol/shared/types";
import { parseEmptyPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseEmptyPacketV4";
import { IMQTTReaderV4 } from "@mqtt/protocol/v4/types";
import { createEmptyPacketFixedHeader } from "tests/helpers/mqtt/protocol/createFixedHeader";
import { describe, it, expect } from "vitest";

describe("parseEmptyPacketV4", () => {
  // commonly used reader mock
  const readerMock = {} as unknown as IMQTTReaderV4;

  it(`parse PINGREQ, PINGRESP and DISCONNECT packets`, () => {
    [PacketType.PINGREQ, PacketType.PINGRESP, PacketType.DISCONNECT].forEach(
      (validPacketType) => {
        const fixedHeader = createEmptyPacketFixedHeader(validPacketType);
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
      const fixedHeader = createEmptyPacketFixedHeader(invalidPacketType);

      expect(() => parseEmptyPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet type/
      );
    });
  });

  // Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
  // it is reserved for future use and MUST be set to the value listed in that table
  // [MQTT-2.2.2-1]
  //
  // The Server MUST validate that reserved bits are set to zero and disconnect the Client if they are not zero.
  // [MQTT-3.14.1-1]
  it(`throws an Error for invalid flags`, () => {
    [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80].forEach((invalidFlags) => {
      const fixedHeader = createEmptyPacketFixedHeader(
        PacketType.PINGREQ,
        invalidFlags
      );

      expect(() => parseEmptyPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet flags/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (declared in fixed header)`, () => {
    [1, 2, 3, 4, 5].forEach((invalidRemainingLength) => {
      const fixedHeader = createEmptyPacketFixedHeader(
        PacketType.PINGRESP,
        0b0000,
        invalidRemainingLength
      );

      expect(() => parseEmptyPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet remaining length/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [1, 2, 3].forEach((remaining) => {
      const fixedHeader = createEmptyPacketFixedHeader(PacketType.DISCONNECT);
      const readerMock = { remaining: remaining } as unknown as IMQTTReaderV4;

      expect(() => parseEmptyPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid remaining bytes count in reader/
      );
    });
  });
});
