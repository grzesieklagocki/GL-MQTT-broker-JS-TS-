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
        9, // initial remaining value
        7, // value after reading identifier
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

  // Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
  // it is reserved for future use and MUST be set to the value listed in that table
  // [MQTT-2.2.2-1]
  //
  // Bits 3,2,1 and 0 of the fixed header of the SUBSCRIBE Control Packet are reserved
  // and MUST be set to 0,0,1 and 0 respectively.
  // The Server MUST treat any other value as malformed and close the Network Connection
  // [MQTT-3.8.1-1]
  it(`throws an Error for invalid flags`, () => {
    [0b0000, 0b0001, 0b0011, 0b0100, 0b1000, 0b1010].forEach((invalidFlags) => {
      const fixedHeader = createSubscribeFixedHeader(6, invalidFlags);

      expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet flags/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (< 6 declared in fixed header)`, () => {
    [0, 1, 2, 3, 4, 5].forEach((invalidRemainingLength) => {
      const fixedHeader = createSubscribeFixedHeader(invalidRemainingLength);

      expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
        /header/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (< 6 in reader)`, () => {
    [0, 1, 2, 3, 4, 5].forEach((remaining) => {
      const fixedHeader = createSubscribeFixedHeader(remaining);
      const readerMock = {
        remaining: remaining,
      } as unknown as IMQTTReaderV4;

      expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
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
      const fixedHeader = createSubscribeFixedHeader(declared);
      const readerMock = {
        remaining: real,
      } as unknown as IMQTTReaderV4;

      expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
        /remaining/
      );
    });
  });

  it("correctly parses Identifier value", () => {
    [1, 255, 260, 4660, 63535].forEach((identifier) => {
      const readerMock = createSubscribeReaderMock(
        [
          6, // initial remaining value
          1, // // value after reading identifier
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
      [
        6, // initial remaining value
        1, // // value after reading identifier
        0, // value after reading first subscription
      ],
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
        12, // initial remaining value
        10, // // value after reading identifier
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
        4, // value after reading first subscription
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
          4, // value after reading identifier
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
          4, // value after reading first subscription
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
        4, // // value after reading identifier
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
      [
        6, // initial remaining value
      ],
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
        4, // value after reading identifier
        0, // after parsing
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
        4, // value after reading identifier
        0, // after parsing
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
