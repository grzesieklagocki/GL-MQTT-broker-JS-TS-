import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parseUnsubscribePacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseUnsubscribePacketV4";
import {
  createFixedHeader,
  createUnsubscribeFixedHeader,
} from "tests/helpers/mqtt/protocol/createFixedHeader";
import { describe, it, expect } from "vitest";

//
// integration tests for parseUnsubscribePacketV4 using MQTTReaderV4 with data buffers
//

describe("parseUnsubscribePacketV4", () => {
  it(`parse UNSUBSCRIBE packet`, () => {
    const fixedHeader = createUnsubscribeFixedHeader(8);
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
      const fixedHeader = createFixedHeader(
        invalidPacketType,
        0b0010, // flags
        9 // remaining length
      );
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

  it("correctly parses Identifier value", () => {
    [
      { input: [0x00, 0x01], expected: 1 },
      { input: [0x00, 0xff], expected: 255 },
      { input: [0x01, 0x04], expected: 260 },
      { input: [0x12, 0x34], expected: 4660 },
      { input: [0xff, 0xff], expected: 65535 },
    ].forEach(({ input, expected }) => {
      const fixedHeader = createUnsubscribeFixedHeader(5);
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
      const fixedHeader = createUnsubscribeFixedHeader(2 + input.length);
      const remainingData = new Uint8Array([0xfc, 0x45, ...input]);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parseUnsubscribePacketV4(fixedHeader, reader);

      expect(packet.topicFilterList).toEqual(expected);
    });
  });

  it(`throws an Error for invalid topic filters`, () => {
    [
      // empty first topic filter [null]
      [0x00, 0x00],
      // empty second topic filter [i, null]
      [0x00, 0x01, 0x69, 0x00, 0x00],
      // invalid topic filter length
      [0x00, 0x01, 0x62, 0x61],
      [0x00, 0x01, 0x63, 0x00, 0x02, 0x67],
      [0x00, 0x01, 0x64, 0x00, 0x01, 0x67, 0x66],

      // overlong encoding (invalid in MQTT UTF-8)
      [0x00, 0x02, 0xc0, 0xaf],
      // surrogate half (invalid in UTF-8)
      [0x00, 0x03, 0xed, 0xa0, 0x80],
      // continuation byte without a leading byte
      [0x00, 0x01, 0x80],
      // incomplete multi-byte sequence
      [0x00, 0x02, 0xe2, 0x28],
      // illegal byte (0xfe, 0xff are not valid in UTF-8)
      [0x00, 0x02, 0xfe, 0xff],
    ].forEach((topicFilter) => {
      const fixedHeader = createUnsubscribeFixedHeader(2 + topicFilter.length);
      const remainingData = new Uint8Array([0xfc, 0x45, ...topicFilter]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseUnsubscribePacketV4(fixedHeader, reader)).toThrow(
        /topic/
      );
    });
  });

  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  it(`throws an Error for zero-length first topic filter`, () => {
    const fixedHeader = createUnsubscribeFixedHeader(7);
    const remainingData = new Uint8Array([
      // packet identifier
      0x01, 0x05,
      // topic 1 filter length
      0x00, 0x00,
      // topic 1 filter: empty

      // topic 2 filter length
      0x00, 0x00,
      // topic 2 filter: "/"
      0x2f,
    ]);
    const reader = new MQTTReaderV4(remainingData);

    expect(() => parseUnsubscribePacketV4(fixedHeader, reader)).toThrowError(
      /topic length/
    );
  });

  it(`throws an Error for zero-length second topic filter`, () => {
    const fixedHeader = createUnsubscribeFixedHeader(7);
    const remainingData = new Uint8Array([
      // packet identifier
      0x01, 0x05,
      // topic 1 filter length
      0x00, 0x01,
      // topic 1 filter: "/"
      0x2f,
      // topic 2 filter length
      0x00, 0x00,
      // topic 2 filter: empty
    ]);
    const reader = new MQTTReaderV4(remainingData);

    expect(() => parseUnsubscribePacketV4(fixedHeader, reader)).toThrowError(
      /topic length/
    );
  });

  // Topic Names and Topic Filters MUST NOT include the null character (Unicode U+0000).
  // [MQTT-4.7.3-2]
  it(`throws an Error for topic filter containing null character`, () => {
    const fixedHeader = createUnsubscribeFixedHeader(9);
    const remainingData = new Uint8Array([
      // packet identifier
      0x01, 0x05,
      // topic filter length
      0x00, 0x05,
      // topic filter: "test" + null
      0x74, 0x65, 0x73, 0x74, 0x00,
    ]);
    const reader = new MQTTReaderV4(remainingData);

    expect(() => parseUnsubscribePacketV4(fixedHeader, reader)).toThrowError(
      /topic/
    );
  });
});
