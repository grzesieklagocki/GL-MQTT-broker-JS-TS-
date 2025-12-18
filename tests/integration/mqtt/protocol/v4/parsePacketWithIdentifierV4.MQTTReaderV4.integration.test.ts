import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parsePacketWithIdentifierV4 } from "@mqtt/protocol/v4/decoding/parsers/parsePacketWithIdentifierV4";
import {
  createFixedHeader,
  createPacketWithIdentifierFixedHeader,
} from "tests/helpers/mqtt/protocol/createFixedHeader";
import { describe, it, expect } from "vitest";

//
// integration tests for parsePacketWithIdentifierV4 using MQTTReaderV4 with data buffers
//

describe("parsePacketWithIdentifierV4", () => {
  it(`parses PUBACK, PUBREC, PUBREL, PUBCOMP and UNSUBACK packets`, () => {
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
      const remainingData = new Uint8Array([0x12, 0x34]);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parsePacketWithIdentifierV4(fixedHeader, reader);

      expect(packet.typeId).toBe(validPacketType);
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
      const remainingData = new Uint8Array([0x12, 0x34]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parsePacketWithIdentifierV4(fixedHeader, reader)).toThrow(
        /Invalid packet type/
      );
    });
  });

  it("correctly parses Identifier value", () => {
    [
      { input: [0x00, 0x01], expected: 1 },
      { input: [0x00, 0xff], expected: 255 },
      { input: [0x01, 0x04], expected: 260 },
      { input: [0x12, 0x34], expected: 4660 },
      { input: [0xff, 0xff], expected: 65535 },
    ].forEach(({ input, expected }) => {
      const fixedHeader = createPacketWithIdentifierFixedHeader(
        PacketType.PUBACK
      );
      const remainingData = new Uint8Array(input);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parsePacketWithIdentifierV4(fixedHeader, reader);

      expect(packet.identifier).toBe(expected);
    });
  });
});
