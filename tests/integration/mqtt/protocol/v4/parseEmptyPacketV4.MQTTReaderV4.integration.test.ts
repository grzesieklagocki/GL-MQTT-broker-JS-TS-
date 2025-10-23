import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parseEmptyPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseEmptyPacketV4";
import {
  createEmptyPacketFixedHeader,
  createFixedHeader,
} from "tests/helpers/mqtt/protocol/createFixedHeader";
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
      const remainingData = new Uint8Array();
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseEmptyPacketV4(fixedHeader, reader)).toThrow(
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
      const remainingData = new Uint8Array([0x12, 0x34]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseEmptyPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet remaining length/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [
      [0xff], // one byte
      [0xc1, 0x0a], // two bytes
      [0x12, 0x23, 0x34], // three bytes
    ].forEach((array) => {
      const fixedHeader = createEmptyPacketFixedHeader(PacketType.DISCONNECT);
      const remainingData = new Uint8Array(array);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseEmptyPacketV4(fixedHeader, reader)).toThrow(
        /Invalid remaining bytes count in reader/
      );
    });
  });
});
