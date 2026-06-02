import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parseEmptyPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseEmptyPacketV4";
import { createEmptyPacketFixedHeader } from "@tests/helpers/mqtt/protocol/createFixedHeader";
import { describe, it, expect } from "vitest";

//
// integration tests for parseEmptyPacketV4 using MQTTReaderV4 with data buffers
//

describe("parseEmptyPacketV4", () => {
  it(`parses PINGREQ, PINGRESP and DISCONNECT packets`, () => {
    [PacketType.PINGREQ, PacketType.PINGRESP, PacketType.DISCONNECT].forEach(
      (validPacketType) => {
        const fixedHeader = createEmptyPacketFixedHeader(validPacketType);
        const remainingData = new Uint8Array();
        const reader = new MQTTReaderV4(remainingData);
        const packet = parseEmptyPacketV4(fixedHeader, reader);

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
      const remainingData = new Uint8Array();
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseEmptyPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet type/
      );
    });
  });
});
