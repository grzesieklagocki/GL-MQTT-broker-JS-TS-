import { PacketType } from "@mqtt/protocol/shared/types";
import { parseUnsubscribePacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseUnsubscribePacketV4";
import { IMQTTReaderV4 } from "@mqtt/protocol/v4/types";
import { describe, it, expect } from "vitest";
import { createUnsubscribeReaderMock, getErrorMock } from "./mocks";
import {
  createFixedHeader,
  createUnsubscribeFixedHeader,
} from "tests/helpers/mqtt/protocol/createFixedHeader";

describe("parseUnsubscribePacketV4", () => {
  // commonly used fixed header for UNSUBSCRIBE packet
  const fixedHeader = createUnsubscribeFixedHeader(6);

  // commonly used reader mock for UNSUBSCRIBE packet
  const readerMock = {} as unknown as IMQTTReaderV4;

  it(`parse UNSUBSCRIBE packet`, () => {
    const fixedHeader = createUnsubscribeFixedHeader(8);
    const readerMock = createUnsubscribeReaderMock(
      [
        8, // initial remaining value
        6, // value after reading identifier
      ],
      0x0105, // packet identifier
      ["test"] // topic filter: "test"
    );

    const packet = parseUnsubscribePacketV4(fixedHeader, readerMock);

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
      const fixedHeader = createFixedHeader(invalidPacketType, 0b0010, 9);

      expect(() => parseUnsubscribePacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet type/
      );
    });
  });

  // Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
  // it is reserved for future use and MUST be set to the value listed in that table
  // [MQTT-2.2.2-1]
  //
  // Bits 3,2,1 and 0 of the fixed header of the UNSUBSCRIBE Control Packet are reserved
  // and MUST be set to 0,0,1 and 0 respectively.
  // The Server MUST treat any other value as malformed and close the Network Connection
  // [MQTT-3.10.1-1]
  it(`throws an Error for invalid flags`, () => {
    [0b0000, 0b0001, 0b0011, 0b0100, 0b1000, 0b1010].forEach((invalidFlags) => {
      const fixedHeader = createUnsubscribeFixedHeader(6, invalidFlags);

      expect(() => parseUnsubscribePacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet flags/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (< 5 declared in fixed header)`, () => {
    [0, 1, 2, 3, 4].forEach((invalidRemainingLength) => {
      const fixedHeader = createUnsubscribeFixedHeader(invalidRemainingLength);

      expect(() => parseUnsubscribePacketV4(fixedHeader, readerMock)).toThrow(
        /header/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (<5 in reader)`, () => {
    [0, 1, 2, 3, 4].forEach((remaining) => {
      const fixedHeader = createUnsubscribeFixedHeader(remaining);
      const readerMock = {
        remaining: remaining,
      } as unknown as IMQTTReaderV4;

      expect(() => parseUnsubscribePacketV4(fixedHeader, readerMock)).toThrow(
        /reader/
      );
    });
  });

  it(`throws an Error when remaining bytes length declared in fixed header not match remaining in reader`, () => {
    [
      {
        declared: 5,
        real: 6,
      },
      {
        declared: 6,
        real: 5,
      },
    ].forEach(({ declared, real }) => {
      const fixedHeader = createUnsubscribeFixedHeader(declared);
      const readerMock = {
        remaining: real,
      } as unknown as IMQTTReaderV4;

      expect(() => parseUnsubscribePacketV4(fixedHeader, readerMock)).toThrow(
        /remaining/
      );
    });
  });

  it("correctly parses Identifier value", () => {
    [1, 255, 260, 4660, 63535].forEach((identifier) => {
      const fixedHeader = createUnsubscribeFixedHeader(5);
      const readerMock = createUnsubscribeReaderMock(
        [
          5, // initial remaining value
          3, // // value after reading identifier
          0, // value after reading first topic filter
        ],
        identifier, // packet identifier
        ["/"] // topic filter: "test"
      );

      const packet = parseUnsubscribePacketV4(fixedHeader, readerMock);

      expect(packet.identifier).toBe(identifier);
    });
  });

  // SUBSCRIBE, UNSUBSCRIBE, and PUBLISH (in cases where QoS > 0)
  // Control Packets MUST contain a non-zero 16-bit Packet Identifier
  // [MQTT-2.3.1-1]
  it("throws an Error when Identifier is invalid", () => {
    const fixedHeader = createUnsubscribeFixedHeader(5);
    const readerMock = createUnsubscribeReaderMock(
      [
        5, // initial remaining value
        3, // // value after reading identifier
        0, // value after reading first topic filter
      ],
      0, // packet identifier
      ["/"] // topic filter: "test"
    );

    expect(() =>
      parseUnsubscribePacketV4(fixedHeader, readerMock)
    ).toThrowError(/non-zero/);
  });

  // [MQTT-3.10.3-1]
  // The Topic Filters in an UNSUBSCRIBE packet MUST be UTF-8 encoded strings as defined in Section 1.5.3, packed contiguously.
  it(`throws an Error for invalid UTF-8 encoding in topic`, () => {
    const readerMock = createUnsubscribeReaderMock(
      [
        6, // initial remaining value
        4, // // value after reading identifier
      ],
      1, // packet identifier
      [new Error("UTF-8")] // invalid UTF-8 topic
    );

    expect(() => parseUnsubscribePacketV4(fixedHeader, readerMock)).toThrow(
      /UTF-8/
    );
  });

  // [MQTT-3.10.3-2]
  // The Payload of an UNSUBSCRIBE packet MUST contain at least one Topic Filter.
  // An UNSUBSCRIBE packet with no payload is a protocol violation.
  it(`throws an Error for empty topic filter list`, () => {
    const readerMock = createUnsubscribeReaderMock(
      [
        6, // initial remaining value
        4, // // value after reading identifier
      ],
      1, // packet identifier
      [] // empty topic filter list
    );

    expect(() =>
      parseUnsubscribePacketV4(fixedHeader, readerMock)
    ).toThrowError(/topic/);
  });

  it("correctly parses list of two topic filters", () => {
    const fixedHeader = createUnsubscribeFixedHeader(12);
    const readerMock = createUnsubscribeReaderMock(
      [
        12, // initial remaining value
        10, // // value after reading identifier
        6, // value after reading first topic filter
        0, // value after reading second topic filter
      ],
      1, // packet identifier
      ["t1", "t2/a"] // topic filter: "test"
    );

    const packet = parseUnsubscribePacketV4(fixedHeader, readerMock);

    expect(packet.topicFilterList).toEqual(["t1", "t2/a"]);
  });

  it(`throws an Error for invalid first topic filter`, () => {
    const fixedHeader = createUnsubscribeFixedHeader(5);
    const error = getErrorMock("topic") as unknown as string;
    const readerMock = createUnsubscribeReaderMock(
      [
        5, // initial remaining value
        3, // // value after reading identifier
      ],
      1, // packet identifier
      [error] // topic1 filter throws an error
    );

    expect(() => parseUnsubscribePacketV4(fixedHeader, readerMock)).toThrow(
      /topic/
    );
  });

  it(`throws an Error for invalid second topic filter`, () => {
    const fixedHeader = createUnsubscribeFixedHeader(8);
    const error = getErrorMock("topic") as unknown as string;
    const readerMock = createUnsubscribeReaderMock(
      [
        8, // initial remaining value
        6, // value after reading identifier
        3, // value after reading first topic filter
      ],
      1, // packet identifier
      ["/", error] // topic1 filter
    );

    expect(() => parseUnsubscribePacketV4(fixedHeader, readerMock)).toThrow(
      /topic/
    );
  });

  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  it(`throws an Error for zero-length topic name`, () => {
    const readerMock = createUnsubscribeReaderMock(
      [
        6, // initial remaining value
        4, // value after reading identifier
        0, // after parsing
      ],
      1, // packet identifier
      [
        "", // zero-length topic name
      ]
    );

    expect(() => parseUnsubscribePacketV4(fixedHeader, readerMock)).toThrow(
      /Invalid topic length/
    );
  });

  // Topic Names and Topic Filters MUST NOT include the null character (Unicode U+0000).
  // [MQTT-4.7.3-2]
  it(`throws an Error for topic name containing null character`, () => {
    const readerMock = createUnsubscribeReaderMock(
      [
        6, // initial remaining value
        4, // value after reading identifier
        0, // after parsing
      ],
      1, // packet identifier
      [
        new Error("null"), // invalid topic name
      ]
    );

    expect(() => parseUnsubscribePacketV4(fixedHeader, readerMock)).toThrow(
      /null/
    );
  });
});
