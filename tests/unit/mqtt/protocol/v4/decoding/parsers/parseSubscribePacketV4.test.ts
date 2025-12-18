import { PacketType, QoS } from "@mqtt/protocol/shared/types";
import { parseSubscribePacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseSubscribePacketV4";
import { IMQTTReaderV4 } from "@mqtt/protocol/v4/types";
import { describe, it, expect } from "vitest";
import { createSubscribeReaderMock, getErrorMock } from "./mocks";
import {
  createFixedHeader,
  createSubscribeFixedHeader,
} from "tests/helpers/mqtt/protocol/createFixedHeader";

describe("parseSubscribePacketV4", () => {
  // commonly used fixed header for SUBSCRIBE packet
  const fixedHeader = createSubscribeFixedHeader(6);

  // commonly used reader mock for SUBSCRIBE packet
  const readerMock = {} as unknown as IMQTTReaderV4;

  it(`parse SUBSCRIBE packet`, () => {
    const fixedHeader = createSubscribeFixedHeader(9);
    const readerMock = createSubscribeReaderMock(
      [
        7, // remaining value after reading identifier
        0, // value after reading first subscription
      ],
      0x0105, // packet identifier
      [["test", 1]] // subscription list
    );

    const packet = parseSubscribePacketV4(fixedHeader, readerMock);

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

      expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet type/
      );
    });
  });

  it("correctly parses Identifier value", () => {
    [1, 255, 260, 4660, 63535].forEach((identifier) => {
      const readerMock = createSubscribeReaderMock(
        [
          1, // // remaining value after reading identifier
          0, // value after reading first subscription
        ],
        identifier, // packet identifier
        [["/", 0]] // first subscription: "/", qos: 0
      );

      const packet = parseSubscribePacketV4(fixedHeader, readerMock);

      expect(packet.identifier).toBe(identifier);
    });
  });

  // SUBSCRIBE, UNSUBSCRIBE, and PUBLISH (in cases where QoS > 0)
  // Control Packets MUST contain a non-zero 16-bit Packet Identifier
  // [MQTT-2.3.1-1]
  it("throws an Error when Identifier is invalid", () => {
    const readerMock = createSubscribeReaderMock(
      [], // remaining values not needed
      0, // packet identifier
      [["/", 0]] // first subscription: "/", qos: 0
    );

    expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrowError(
      /non-zero/
    );
  });

  it("correctly parses list of two subscriptions", () => {
    const fixedHeader = createSubscribeFixedHeader(12);
    const readerMock = createSubscribeReaderMock(
      [
        10, // // remaining value after reading identifier
        6, // value after reading first subscription
        0, // value after reading second subscription
      ],
      1, // packet identifier
      [
        ["t1", 1], // topic1: "t1", qos: 1
        ["t2/a", 2], // topic2: "t2/a", qos: 2
      ]
    );

    const packet = parseSubscribePacketV4(fixedHeader, readerMock);

    expect(packet.subscriptionList).toEqual([
      ["t1", 1],
      ["t2/a", 2],
    ]);
  });

  it(`throws an Error for invalid first topic`, () => {
    const error = getErrorMock("topic") as unknown as string;
    const readerMock = createSubscribeReaderMock(
      [
        6, // initial remaining value
        4, // // value after reading identifier
      ],
      1, // packet identifier
      [[error, 0]] // topic1 throws an error
    );

    expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
      /topic/
    );
  });

  it(`throws an Error for invalid second topic`, () => {
    const fixedHeader = createSubscribeFixedHeader(10);
    const error = getErrorMock("topic") as unknown as string;
    const readerMock = createSubscribeReaderMock(
      [
        10, // initial remaining value
        8, // value after reading identifier
      ],
      1, // packet identifier
      [
        ["/", 0], // subscription 1
        [error, 1], // subscription 2
      ]
    );

    expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
      /topic/
    );
  });

  // The Server MUST treat a SUBSCRIBE packet as malformed and close the Network Connection
  // if any of Reserved bits in the payload are non-zero, or QoS is not 0,1 or 2.
  // [MQTT-3-8.3-4]
  it(`throws an Error for invalid QoS of first subscription`, () => {
    [3, 4, 7, 255].forEach((invalidQoS) => {
      const readerMock = createSubscribeReaderMock(
        [
          6, // initial remaining value
        ],
        1, // packet identifier
        [["/", invalidQoS as QoS]] // qos of first subscription throws an error
      );

      expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
        /QoS/
      );
    });
  });

  it(`throws an Error for invalid QoS of second subscription`, () => {
    [3, 4, 7, 255].forEach((invalidQoS) => {
      const fixedHeader = createSubscribeFixedHeader(10);

      const readerMock = createSubscribeReaderMock(
        [
          10, // initial remaining value
          8, // value after reading identifier
        ],
        1, // packet identifier
        [
          ["/", 2],
          ["/", invalidQoS as QoS],
        ] // qos of second subscription throws an error
      );

      expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
        /QoS/
      );
    });
  });

  // The Topic Filters in a SUBSCRIBE packet payload MUST be UTF-8 encoded strings as defined in Section 1.5.3.
  // [MQTT-3.8.3-1]
  it(`throws an Error for invalid UTF-8 encoding in topic`, () => {
    const readerMock = createSubscribeReaderMock(
      [
        6, // initial remaining value
      ],
      1, // packet identifier
      [[new Error("UTF-8"), 0]] // invalid UTF-8 topic
    );

    expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
      /UTF-8/
    );
  });

  // The payload of a SUBSCRIBE packet MUST contain at least one Topic Filter / QoS pair.
  // A SUBSCRIBE packet with no payload is a protocol violation.
  // [MQTT-3.8.3-3]
  it(`throws an Error for empty subscription list`, () => {
    const readerMock = createSubscribeReaderMock(
      [], // remaining values not needed
      1, // packet identifier
      [] // empty subscription list
    );
    expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
      /subscription list length/
    );
  });

  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  it(`throws an Error for zero-length topic name`, () => {
    const readerMock = createSubscribeReaderMock(
      [
        6, // initial remaining value
      ],
      1, // packet identifier
      [
        [
          "", // zero-length topic name
          0, // qos
        ],
      ]
    );

    expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
      /Invalid topic length/
    );
  });

  // Topic Names and Topic Filters MUST NOT include the null character (Unicode U+0000).
  // [MQTT-4.7.3-2]
  it(`throws an Error for topic name containing null character`, () => {
    const readerMock = createSubscribeReaderMock(
      [
        6, // initial remaining value
      ],
      1, // packet identifier
      [
        [
          new Error("null"), // invalid topic name
          0, // qos
        ],
      ]
    );

    expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
      /null/
    );
  });
});
