import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@src/mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parseSubscribePacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parseSubscribePacketV4";
import { describe, it, expect } from "vitest";

describe("parseSubscribePacketV4", () => {
  const array = new Uint8Array();
  const reader = new MQTTReaderV4(array);

  it(`parse SUBSCRIBE packet`, () => {
    const fixedHeader = {
      packetType: PacketType.SUBSCRIBE,
      flags: 0b0010,
      remainingLength: 9,
    };

    const array = new Uint8Array([
      // packet identifier: 0x0105
      0x01, 0x05,
      // first subscription length: 4
      0x00, 0x04,
      // first subscription topic: "test"
      0x74, 0x65, 0x73, 0x74,
      // first subscription QoS: 1
      0x01,
    ]);
    const reader = new MQTTReaderV4(array);

    const packet = parseSubscribePacketV4(fixedHeader, reader);

    expect(packet.typeId).toBe(PacketType.SUBSCRIBE);
    expect(packet.identifier).toBe(0x0105);
    expect(packet.subscriptionList).toEqual([["test", 1]]);
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
      PacketType.SUBACK,
      PacketType.UNSUBSCRIBE,
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

      expect(() => parseSubscribePacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet type/
      );
    });
  });

  it(`throws an Error for invalid flags`, () => {
    [0b0000, 0b0001, 0b0011, 0b0100, 0b1000, 0b1010].forEach((invalidFlags) => {
      const fixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: invalidFlags,
        remainingLength: 6,
      };

      expect(() => parseSubscribePacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet flags/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (< 6 declared in fixed header)`, () => {
    [0, 1, 2, 3, 4, 5].forEach((invalidRemainingLength) => {
      const fixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0010,
        remainingLength: invalidRemainingLength,
      };

      const array = new Uint8Array([
        // packet identifier: 0x0105
        0x01, 0x05,
        // first subscription length: 1
        0x00, 0x01,
        // first subscription topic: "t"
        0x74,
        // QoS
        0x00,
      ]);
      const reader = new MQTTReaderV4(array);

      expect(() => parseSubscribePacketV4(fixedHeader, reader)).toThrow(
        /header/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (< 6 in reader)`, () => {
    [0, 1, 2, 3, 4, 5].forEach((remaining) => {
      const fixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0010,
        remainingLength: remaining,
      };

      const array = new Uint8Array([
        // packet identifier: 0x0105
        0x01, 0x05,
        // first subscription length: 4
        0x00, 0x04,
        // first subscription topic: "t"
        0x74,
        // missing QoS
      ]);
      const reader = new MQTTReaderV4(array);

      expect(() => parseSubscribePacketV4(fixedHeader, reader)).toThrow(
        /reader/
      );
    });
  });

  it(`throws an Error when remaining bytes length declared in fixed header not match remaining in reader`, () => {
    [
      {
        declared: 6,
        real: 7,
      },
      {
        declared: 7,
        real: 6,
      },
    ].forEach(({ declared, real }) => {
      const fixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0010,
        remainingLength: declared,
      };
      const array = new Uint8Array(real);
      const reader = new MQTTReaderV4(array);

      expect(() => parseSubscribePacketV4(fixedHeader, reader)).toThrow(
        /remaining/
      );
    });
  });

  it("correctly parses Identifier value", () => {
    [1, 255, 260, 4660, 63535].forEach((identifier) => {
      const fixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0010,
        remainingLength: 6,
      };

      const array = new Uint8Array([
        // packet identifier
        identifier >> 8,
        identifier,
        // first subscription topic length: 1
        0x00,
        0x01,
        // first subscription topic: "s"
        0x73,
        // first subscription QoS
        0x02,
      ]);
      const reader = new MQTTReaderV4(array);

      const packet = parseSubscribePacketV4(fixedHeader, reader);

      expect(packet.identifier).toBe(identifier);
    });
  });

  it("correctly parses list of two subscriptions", () => {
    const fixedHeader = {
      packetType: PacketType.SUBSCRIBE,
      flags: 0b0010,
      remainingLength: 14,
    };

    const array = new Uint8Array([
      // packet identifier
      0x00, 0x01,
      // first subscription topic length: 2
      0x00, 0x02,
      // first subscription topic: "t1"
      0x74, 0x31,
      // first subscription QoS: 1
      0x01,
      // second subscription topic length: 4
      0x00, 0x04,
      // second subscription topic: "t2/a"
      0x74, 0x32, 0x2f, 0x61,
      // second subscription QoS: 2
      0x02,
    ]);
    const reader = new MQTTReaderV4(array);

    const packet = parseSubscribePacketV4(fixedHeader, reader);

    expect(packet.subscriptionList).toEqual([
      ["t1", 1],
      ["t2/a", 2],
    ]);
  });

  // List of invalid UTF-8 encoded topics
  const invalidTopics = [
    // Invalid lead byte (110xxxxx without continuation)
    new Uint8Array([0xc2]),
    // Invalid sequence: continuation without lead byte
    new Uint8Array([0x80]),
    // Extra continuation byte
    new Uint8Array([0xe2, 0x28, 0xa1]),
    // 4-byte lead byte, too short sequence
    new Uint8Array([0xf0, 0x9f, 0x92]),
    // UTF-8 with forbidden codes (e.g. U+0000)
    new Uint8Array([0x00]),
    // Overlong encoding for ASCII 'A' (should be 0x41)
    new Uint8Array([0xc1, 0x81]),
    // UTF-8 with surrogate code (forbidden in MQTT)
    new Uint8Array([0xed, 0xa0, 0x80]),
    // UTF-8 with invalid lead byte
    new Uint8Array([0xfe]),
    // UTF-8 with invalid lead byte
    new Uint8Array([0xff]),
    // Valid lead, but too few continuation bytes
    new Uint8Array([0xe2, 0x82]),
    // Valid lead, but continuation not in 0x80-0xBF range
    new Uint8Array([0xe2, 0x28, 0xa1]),
    // Overlong encoding for '/' (should be 0x2F)
    new Uint8Array([0xc0, 0xaf]),
  ];

  it(`throws an Error for invalid first topic`, () => {
    invalidTopics.forEach((encodedTopic) => {
      const fixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0010,
        remainingLength: 5 + encodedTopic.length,
      };

      const array = new Uint8Array([
        // packet identifier
        0x00,
        0x01,
        // first subscription topic length
        0x00,
        0x05 + encodedTopic.length,
        // first subscription topic
        ...encodedTopic,
        // first subscription QoS: 1
        0x01,
      ]);
      const reader = new MQTTReaderV4(array);

      expect(() => parseSubscribePacketV4(fixedHeader, reader)).toThrow(
        /topic/
      );
    });
  });

  it(`throws an Error for invalid second topic`, () => {
    invalidTopics.forEach((encodedTopic) => {
      const fixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0010,
        remainingLength: 9 + encodedTopic.length,
      };

      const array = new Uint8Array([
        // packet identifier
        0x00,
        0x01,
        // first subscription topic length
        0x00,
        0x01,
        // first subscription topic: "/"
        0x2f,
        // first subscription QoS: 1
        0x01,
        // second subscription topic length
        0x00,
        0x09 + encodedTopic.length,
        // second subscription topic
        ...encodedTopic,
        // second subscription QoS: 0
        0x00,
      ]);
      const reader = new MQTTReaderV4(array);

      expect(() => parseSubscribePacketV4(fixedHeader, reader)).toThrow(
        /topic/
      );
    });
  });

  it(`throws an Error for invalid QoS of first subscription`, () => {
    [3, 4, 7, 255].forEach((invalidQoS) => {
      const fixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0010,
        remainingLength: 6,
      };

      const array = new Uint8Array([
        // packet identifier
        0x00,
        0x01,
        // first subscription topic length
        0x00,
        0x01,
        // first subscription topic: "/"
        0x2f,
        // first subscription QoS (invalid)
        invalidQoS,
      ]);
      const reader = new MQTTReaderV4(array);

      expect(() => parseSubscribePacketV4(fixedHeader, reader)).toThrow(/QoS/);
    });
  });

  it(`throws an Error for invalid QoS of second subscription`, () => {
    [3, 4, 7, 255].forEach((invalidQoS) => {
      const fixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0010,
        remainingLength: 10,
      };

      const array = new Uint8Array([
        // packet identifier
        0x00,
        0x01,
        // first subscription topic length
        0x00,
        0x01,
        // first subscription topic: "/"
        0x2f,
        // first subscription QoS: 1
        0x01,
        // second subscription topic length
        0x00,
        0x01,
        // second subscription topic: "a"
        0x61,
        // second subscription QoS: (invalid)
        invalidQoS,
      ]);
      const reader = new MQTTReaderV4(array);

      expect(() => parseSubscribePacketV4(fixedHeader, reader)).toThrow(/QoS/);
    });
  });
});
