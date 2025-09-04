import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parseUnsubscribePacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parseUnsubscribePacketV4";
import { describe, it, expect } from "vitest";

//
// integration tests for parseConnackPacketV4 using MQTTReaderV4 with data buffers
//

describe("parseUnsubscribePacketV4", () => {
  it(`parse UNSUBSCRIBE packet`, () => {
    const fixedHeader = {
      packetType: PacketType.UNSUBSCRIBE,
      flags: 0b0010,
      remainingLength: 8,
    };
    const remainingData = new Uint8Array([
      // packet identifier
      0x01, 0x05,
      // topic filter length
      0x00, 0x04,
      // topic filter: "test"
      0x74, 0x65, 0x73, 0x74,
    ]);
    const reader = new MQTTReaderV4(remainingData);
    const packet = parseUnsubscribePacketV4(fixedHeader, reader);

    expect(packet.typeId).toBe(PacketType.UNSUBSCRIBE);
    expect(packet.identifier).toBe(0x0105);
    expect(packet.topicFilterList).toEqual(["test"]);
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
      PacketType.UNSUBACK,
      PacketType.PINGREQ,
      PacketType.PINGRESP,
      PacketType.DISCONNECT,
    ].forEach((invalidPacketType) => {
      const fixedHeader = {
        packetType: invalidPacketType,
        flags: 0b0010,
        remainingLength: 9,
      };
      const remainingData = new Uint8Array([
        // packet identifier
        0x00, 0x05,
        // topic filter length
        0x00, 0x04,
        // topic filter: "test2"
        0x74, 0x65, 0x73, 0x74, 0x32,
      ]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseUnsubscribePacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet type/
      );
    });
  });

  it(`throws an Error for invalid flags`, () => {
    [0b0000, 0b0001, 0b0011, 0b0100, 0b1000, 0b1010].forEach((invalidFlags) => {
      const fixedHeader = {
        packetType: PacketType.UNSUBSCRIBE,
        flags: invalidFlags,
        remainingLength: 6,
      };
      const remainingData = new Uint8Array([
        // packet identifier
        0x00, 0x05,
        // topic filter length
        0x00, 0x02,
        // topic filter: "t1"
        0x74, 0x31,
      ]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseUnsubscribePacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet flags/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (< 5 declared in fixed header)`, () => {
    [0, 1, 2, 3, 4].forEach((invalidRemainingLength) => {
      const fixedHeader = {
        packetType: PacketType.UNSUBSCRIBE,
        flags: 0b0010,
        remainingLength: invalidRemainingLength,
      };
      const remainingData = new Uint8Array([
        // packet identifier
        0x00, 0x05,
        // topic filter length
        0x00, 0x03,
        // topic filter: "t2/"
        0x74, 0x32, 0x2f,
      ]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseUnsubscribePacketV4(fixedHeader, reader)).toThrow(
        /header/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (<5 in reader)`, () => {
    [
      [], // empty buffer
      [0x05], // one byte
      [0x05, 0x07], // two bytes
      [0x05, 0x07, 0x00], // three bytes
      [0x05, 0x07, 0x00, 0x02], // four bytes
    ].forEach((array) => {
      const fixedHeader = {
        packetType: PacketType.UNSUBSCRIBE,
        flags: 0b0010,
        remainingLength: array.length,
      };
      const remainingData = new Uint8Array(array);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseUnsubscribePacketV4(fixedHeader, reader)).toThrow(
        /reader/
      );
    });
  });

  it(`throws an Error when remaining bytes length declared in fixed header not match remaining in reader`, () => {
    [
      {
        declared: 5,

        // legth = 6
        real: [
          // packet identifier
          0x00, 0x0f,
          // topic filter length
          0x00, 0x02,
          // topic filter: "st"
          0x73, 0x74,
        ],
      },
      {
        declared: 6,

        // legth = 5
        real: [
          // packet identifier
          0x00, 0x0f,
          // topic filter length
          0x00, 0x01,
          // topic filter: "s"
          0x73,
        ],
      },
    ].forEach(({ declared, real }) => {
      const fixedHeader = {
        packetType: PacketType.UNSUBSCRIBE,
        flags: 0b0010,
        remainingLength: declared,
      };
      const remainingData = new Uint8Array(real);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseUnsubscribePacketV4(fixedHeader, reader)).toThrow(
        /remaining/
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
      const fixedHeader = {
        packetType: PacketType.UNSUBSCRIBE,
        flags: 0b0010,
        remainingLength: 5,
      };
      const remainingData = new Uint8Array([
        ...input,
        ...[
          // topic filter length
          0x00, 0x01,
          // topic filter: "b"
          0x62,
        ],
      ]);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parseUnsubscribePacketV4(fixedHeader, reader);

      expect(packet.identifier).toBe(expected);
    });
  });

  it("correctly parses all topic filter values", () => {
    [
      {
        input: [
          // topic filter length
          0x00, 0x01,
          // topic filter: "b"
          100,
        ],
        expected: ["d"],
      },
      {
        input: [
          // topic filter length
          0x00, 0x03,
          // topic filter: "t1/"
          0x74, 0x31, 0x2f,
        ],
        expected: ["t1/"],
      },
      {
        input: [
          // topic1 filter length
          0x00, 0x02,
          // topic1 filter: "t1"
          0x74, 0x31,
          // topic2 filter length
          0x00, 0x04,
          // topic2 filter: "t2/a"
          0x74, 0x32, 0x2f, 0x61,
        ],
        expected: ["t1", "t2/a"],
      },
    ].forEach(({ input, expected }) => {
      const fixedHeader = {
        packetType: PacketType.UNSUBSCRIBE,
        flags: 0b0010,
        remainingLength: 2 + input.length,
      };
      const remainingData = new Uint8Array([0xfc, 0x45, ...input]);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parseUnsubscribePacketV4(fixedHeader, reader);

      expect(packet.topicFilterList).toEqual(expected);
    });
  });

  it(`throws an Error for invalid topic filters`, () => {
    [
      // empty first topic filter [null]
      { input: [0x00, 0x00], expected: /reader/ },
      // empty second topic filter [i, null]
      { input: [0x00, 0x01, 0x69, 0x00, 0x00], expected: /topic/ },
      // invalid topic filter length
      { input: [0x00, 0x01, 0x62, 0x61], expected: /topic/ },
      { input: [0x00, 0x01, 0x63, 0x00, 0x02, 0x67], expected: /topic/ },
      { input: [0x00, 0x01, 0x64, 0x00, 0x01, 0x67, 0x66], expected: /topic/ },

      // overlong encoding (invalid in MQTT UTF-8)
      { input: [0x00, 0x02, 0xc0, 0xaf], expected: /topic/ },
      // surrogate half (invalid in UTF-8)
      { input: [0x00, 0x03, 0xed, 0xa0, 0x80], expected: /topic/ },
      // continuation byte without a leading byte
      { input: [0x00, 0x01, 0x80], expected: /topic/ },
      // incomplete multi-byte sequence
      { input: [0x00, 0x02, 0xe2, 0x28], expected: /topic/ },
      // illegal byte (0xfe, 0xff are not valid in UTF-8)
      { input: [0x00, 0x02, 0xfe, 0xff], expected: /topic/ },
    ].forEach(({ input, expected }) => {
      const fixedHeader = {
        packetType: PacketType.UNSUBSCRIBE,
        flags: 0b0010,
        remainingLength: 2 + input.length,
      };
      const remainingData = new Uint8Array([0xfc, 0x45, ...input]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseUnsubscribePacketV4(fixedHeader, reader)).toThrow(
        expected
      );
    });
  });
});
