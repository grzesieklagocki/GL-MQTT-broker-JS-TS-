import { PacketType } from "@mqtt/protocol/shared/types";
import { describe, it, expect } from "vitest";
import { parsePublishPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parsePublishPacketV4";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import {
  createFixedHeader,
  createPublishFixedHeader,
} from "tests/helpers/mqtt/protocol/createFixedHeader";

//
// integration tests for parsePublishPacketV4 using MQTTReaderV4 with data buffers
//

describe("parsePublishPacketV4", () => {
  // commonly used reader for PUBLISH packet
  const reader = new MQTTReaderV4(
    new Uint8Array([
      // topic length: 1
      0x00, 0x01,
      // topic: "/"
      0x2f,
      // no packet identifier
      // application message: empty
    ])
  );

  it(`parses PUBLISH packet`, () => {
    const fixedHeader = createPublishFixedHeader(
      9, // remaining length
      0b1010 // DUP flag set, QoS 1)
    );
    const message = new Uint8Array([0, 1, 2]);
    const array = new Uint8Array([
      // topic length: 2
      0x00,
      0x02,
      // topic: "t1"
      0x74,
      0x31,
      // packet identifier: 0x0105
      0x01,
      0x05,
      // application message
      ...message,
    ]);
    const reader = new MQTTReaderV4(array);

    const packet = parsePublishPacketV4(fixedHeader, reader);

    expect(packet.typeId).toBe(PacketType.PUBLISH);

    expect(packet.flags.dup).toBe(true);
    expect(packet.flags.qosLevel).toBe(1);
    expect(packet.flags.retain).toBe(false);

    expect(packet.topicName).toBe("t1");
    expect(packet.identifier).toBe(0x0105);
    expect(packet.applicationMessage).toEqual(message);
  });

  it(`throws an Error for other packet types`, () => {
    [
      PacketType.CONNECT,
      PacketType.CONNACK,
      PacketType.PUBACK,
      PacketType.PUBREC,
      PacketType.PUBREL,
      PacketType.PUBCOMP,
      PacketType.SUBACK,
      PacketType.SUBSCRIBE,
      PacketType.UNSUBSCRIBE,
      PacketType.UNSUBACK,
      PacketType.PINGREQ,
      PacketType.PINGRESP,
      PacketType.DISCONNECT,
    ].forEach((invalidPacketType) => {
      const fixedHeader = createFixedHeader(invalidPacketType, 0b0000, 3);

      expect(() => parsePublishPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet type/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (declared in fixed header)`, () => {
    [0, 1, 2].forEach((invalidRemainingLength) => {
      const fixedHeader = createPublishFixedHeader(
        invalidRemainingLength, // remaining length
        0b0000 // flags
      );

      expect(() => parsePublishPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet remaining length/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [0, 1, 2].forEach((remaining) => {
      const fixedHeader = createPublishFixedHeader(
        3, // remaining length
        0b0000 // flags
      );

      const reader = new MQTTReaderV4(new Uint8Array(remaining));

      expect(() => parsePublishPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet remaining length in reader/
      );
    });
  });

  // SUBSCRIBE, UNSUBSCRIBE, and PUBLISH (in cases where QoS > 0) Control Packets MUST contain a non-zero 16-bit Packet Identifier
  // [MQTT-2.3.1-1]
  it(`throws an Error for zero packet identifier when QoS > 0`, () => {
    [0b01, 0b10].forEach((qos) => {
      const fixedHeader = createPublishFixedHeader(
        5, // remaining length
        0b0110 & (qos << 1) // flags: QoS 1 or 2
      );
      const array = new Uint8Array([
        // topic length: 1
        0x00, 0x01,
        // topic: "/"
        0x2f,
        // packet identifier: 0x0000
        0x00, 0x00,
        // application message: empty
      ]);
      const reader = new MQTTReaderV4(array);

      expect(() => parsePublishPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet identifier/
      );
    });
  });

  // A PUBLISH Packet MUST NOT contain a Packet Identifier if its QoS value is set to 0
  // [MQTT-2.3.1-5]
  // ***
  // it's not possible to identify the first two bytes of the remaining bytes are identifier or part of message
  // so this test is not implemented
  // ***

  // The DUP flag MUST be set to 0 for all QoS 0 messages
  // [MQTT-3.3.1-2]
  it(`throws an Error for invalid DUP flag`, () => {
    const fixedHeader = createPublishFixedHeader(
      3, // remaining length
      0b1000 // flags: invalid DUP flag for QoS 0
    );

    expect(() => parsePublishPacketV4(fixedHeader, reader)).toThrow(/DUP flag/);
  });

  // A PUBLISH Packet MUST NOT have both QoS bits set to 1.
  // If a Server or Client receives a PUBLISH Packet which has both QoS bits set to 1 it MUST close the Network Connection
  // [MQTT-3.3.1-4]
  it(`throws an Error for invalid QoS flags`, () => {
    const fixedHeader = createPublishFixedHeader(
      3, // remaining length
      0b0110 // flags: invalid QoS (0b11)
    );

    expect(() => parsePublishPacketV4(fixedHeader, reader)).toThrow(
      /Invalid QoS flags/
    );
  });

  // The Topic Name MUST be present as the first field in the PUBLISH Packet Variable header.
  // It MUST be a UTF-8 encoded string
  // [MQTT-3.3.2-1]
  it(`throws an Error for invalid topic name`, () => {
    const fixedHeader = createPublishFixedHeader(
      3, // remaining length
      0b0000 // flags
    );
    const array = new Uint8Array([
      // topic length: 1
      0x00, 0x01,
      // topic: invalid UTF-8 byte sequence
      0xff,
      // no packet identifier
      // application message: empty
    ]);
    const reader = new MQTTReaderV4(array);

    expect(() => parsePublishPacketV4(fixedHeader, reader)).toThrow(/topic/);
  });

  // The Topic Name in the PUBLISH Packet MUST NOT contain wildcard characters
  // [MQTT-3.3.2-2]
  it(`throws an Error for topic name containing wildcard characters`, () => {
    ["t/+", "t/#", "+/t", "#/t", "t/#/t", "t/+/t"].forEach((invalidTopic) => {
      const encoder = new TextEncoder();
      const topicBytes = encoder.encode(invalidTopic);
      const length = topicBytes.length;
      const lengthBytes = [(length >> 8) & 0xff, length & 0xff];

      const array = new Uint8Array([...lengthBytes, ...topicBytes]);
      const reader = new MQTTReaderV4(array);

      const fixedHeader = createPublishFixedHeader(
        2 + length, // remaining length
        0b0000 // flags
      );

      expect(() => parsePublishPacketV4(fixedHeader, reader)).toThrow(
        /wildcard/
      );
    });
  });

  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  it(`throws an Error for zero-length topic name`, () => {
    const fixedHeader = createPublishFixedHeader(
      4, // remaining length
      0b0010 // flags: QoS 1
    );
    const array = new Uint8Array([
      // topic length: 0
      0x00, 0x00,
      // empty topic
      // packet identifier: 0x0105
      0x01, 0x05,
      // application message: empty
    ]);
    const reader = new MQTTReaderV4(array);

    expect(() => parsePublishPacketV4(fixedHeader, reader)).toThrow(
      /Invalid topic length/
    );
  });

  // Topic Names and Topic Filters MUST NOT include the null character (Unicode U+0000).
  // [MQTT-4.7.3-2]
  it(`throws an Error for topic name containing null character`, () => {
    const fixedHeader = createPublishFixedHeader(
      5, // remaining length
      0b0000 // flags
    );
    const array = new Uint8Array([
      // topic length: 3
      0x00, 0x03,
      // topic: 'a'\o'b'
      0x61, 0x00, 0x62,
      // no packet identifier
      // application message: empty
    ]);
    const reader = new MQTTReaderV4(array);

    expect(() => parsePublishPacketV4(fixedHeader, reader)).toThrow(/topic/);
  });
});
