import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parseSubscribePacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseSubscribePacketV4";
import {
  createFixedHeader,
  createSubscribeFixedHeader,
} from "tests/helpers/mqtt/protocol/createFixedHeader";
import { describe, it, expect } from "vitest";

//
// integration tests for parseSubscribePacketV4 using MQTTReaderV4 with data buffers
//

describe("parseSubscribePacketV4", () => {
  const array = new Uint8Array();
  const reader = new MQTTReaderV4(array);

  it(`parse SUBSCRIBE packet`, () => {
    const fixedHeader = createSubscribeFixedHeader(9);
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
      const fixedHeader = createFixedHeader(invalidPacketType, 0b0010, 9);

      expect(() => parseSubscribePacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet type/
      );
    });
  });

  it("correctly parses Identifier value", () => {
    [1, 255, 260, 4660, 63535].forEach((identifier) => {
      const fixedHeader = createSubscribeFixedHeader(6);
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
    const fixedHeader = createSubscribeFixedHeader(14);
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
      const fixedHeader = createSubscribeFixedHeader(5 + encodedTopic.length);
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
      const fixedHeader = createSubscribeFixedHeader(9 + encodedTopic.length);
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
      const fixedHeader = createSubscribeFixedHeader(6);
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
      const fixedHeader = createSubscribeFixedHeader(10);
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

  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  it(`throws an Error for zero-length first topic filter`, () => {
    const fixedHeader = createSubscribeFixedHeader(9);
    const remainingData = new Uint8Array([
      // packet identifier
      0x00, 0x01,
      // first subscription topic length
      0x00, 0x00,
      // first subscription topic: empty

      // first subscription QoS: 1
      0x01,
      // second subscription topic length
      0x00, 0x01,
      // second subscription topic: "/"
      0x2f,
      // second subscription QoS: 2
      0x02,
    ]);
    const reader = new MQTTReaderV4(remainingData);

    expect(() => parseSubscribePacketV4(fixedHeader, reader)).toThrowError(
      /topic length/
    );
  });

  it(`throws an Error for zero-length second topic filter`, () => {
    const fixedHeader = createSubscribeFixedHeader(9);
    const remainingData = new Uint8Array([
      // packet identifier
      0x00, 0x01,
      // first subscription topic length
      0x00, 0x01,
      // first subscription topic: "/"
      0x2f,
      // first subscription QoS: 1
      0x01,
      // second subscription topic length
      0x00, 0x00,
      // second subscription topic: empty

      // second subscription QoS: 2
      0x02,
    ]);
    const reader = new MQTTReaderV4(remainingData);

    expect(() => parseSubscribePacketV4(fixedHeader, reader)).toThrowError(
      /topic length/
    );
  });

  // Topic Names and Topic Filters MUST NOT include the null character (Unicode U+0000).
  // [MQTT-4.7.3-2]
  it(`throws an Error for topic filter containing null character`, () => {
    const fixedHeader = createSubscribeFixedHeader(10);
    const remainingData = new Uint8Array([
      // packet identifier
      0x01, 0x05,
      // topic filter length
      0x00, 0x05,
      // topic filter: "test" + null
      0x74, 0x65, 0x73, 0x74, 0x00,
      // QoS: 0
      0x00,
    ]);
    const reader = new MQTTReaderV4(remainingData);

    expect(() => parseSubscribePacketV4(fixedHeader, reader)).toThrowError(
      /topic/
    );
  });
});
