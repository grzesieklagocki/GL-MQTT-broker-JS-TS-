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
});
