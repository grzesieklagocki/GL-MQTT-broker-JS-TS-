import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parsePacketWithIdentifierV4 } from "@mqtt/protocol/v4/decoding/parsers/parsePacketWithIdentifierV4";
import { createFixedHeader, createPacketWithIdentifierFixedHeader } from "tests/helpers/mqtt/protocol/createFixedHeader";
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

  // Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
  // it is reserved for future use and MUST be set to the value listed in that table
  // [MQTT-2.2.2-1]
  //
  // Bits 3,2,1 and 0 of the fixed header in the PUBREL Control Packet are reserved
  // and MUST be set to 0,0,1 and 0 respectively.
  // The Server MUST treat any other value as malformed and close the Network Connection
  // [MQTT-3.6.1-1]
  it(`throws an Error for invalid flags (for PUBREL)`, () => {
    [0b0000, 0b0001, 0b0011, 0b0100, 0b1000, 0b1010].forEach((invalidFlags) => {
      const fixedHeader = createPacketWithIdentifierFixedHeader(
        PacketType.PUBREL,
        invalidFlags
      );
      const remainingData = new Uint8Array([0x12, 0x34]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parsePacketWithIdentifierV4(fixedHeader, reader)).toThrow(
        /Invalid packet flags/
      );
    });
  });

  // Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
  // it is reserved for future use and MUST be set to the value listed in that table
  // [MQTT-2.2.2-1]
  it(`throws an Error for invalid flags (for other packet types)`, () => {
    [
      PacketType.PUBACK,
      PacketType.PUBREC,
      PacketType.PUBCOMP,
      PacketType.UNSUBACK,
    ].forEach((packetType) => {
      [0b0001, 0b0010, 0b0011, 0b0100, 0b1000, 0b1010].forEach(
        (invalidFlags) => {
          const fixedHeader = createPacketWithIdentifierFixedHeader(
            packetType,
            invalidFlags
          );
          const remainingData = new Uint8Array([0x12, 0x34]);
          const reader = new MQTTReaderV4(remainingData);

          expect(() =>
            parsePacketWithIdentifierV4(fixedHeader, reader)
          ).toThrow(/Invalid packet flags/);
        }
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (declared in fixed header)`, () => {
    [0, 1, 3, 4, 5].forEach((invalidRemainingLength) => {
      const fixedHeader = createPacketWithIdentifierFixedHeader(
        PacketType.PUBREC,
        0b0000,
        invalidRemainingLength
      );
      const remainingData = new Uint8Array([0x12, 0x34]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parsePacketWithIdentifierV4(fixedHeader, reader)).toThrow(
        /Invalid packet remaining length/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [
      [], // empty buffer
      [0xff], // only one byte
      [0x12, 0x23, 0x34], // three bytes
    ].forEach((array) => {
      const fixedHeader = createPacketWithIdentifierFixedHeader(
        PacketType.PUBREL,
        0b0010
      );
      const remainingData = new Uint8Array(array);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parsePacketWithIdentifierV4(fixedHeader, reader)).toThrow(
        /Invalid remaining bytes count in reader/
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
