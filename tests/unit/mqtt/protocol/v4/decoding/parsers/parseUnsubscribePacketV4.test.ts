import { PacketType } from "@mqtt/protocol/shared/types";
import { IMQTTReaderV4, UnsubscribePacketV4 } from "@mqtt/protocol/v4/types";
import { describe, it, expect } from "vitest";
import { createUnsubscribeReaderMock, getErrorMock } from "./mocks";
import { createUnsubscribeFixedHeader } from "@tests/helpers/mqtt/protocol/createFixedHeader";
import { parseMqttPacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parseMqttPacketV4";

describe("parseUnsubscribePacketV4", () => {
  // commonly used fixed header for UNSUBSCRIBE packet
  const fixedHeader = createUnsubscribeFixedHeader(6);

  // commonly used reader mock for UNSUBSCRIBE packet
  const readerMock = {} as unknown as IMQTTReaderV4;

  it(`parse UNSUBSCRIBE packet`, () => {
    const fixedHeader = createUnsubscribeFixedHeader(8);
    const readerMock = createUnsubscribeReaderMock(
      [
        6, // remaining value after reading identifier
      ],
      0x0105, // packet identifier
      ["test"] // topic filter: "test"
    );

    const packet = parseMqttPacketV4(
      fixedHeader,
      readerMock
    ) as UnsubscribePacketV4;

    expect(packet.typeId).toBe(PacketType.UNSUBSCRIBE);
    expect(packet.identifier).toBe(0x0105);
    expect(packet.topicFilterList).toEqual(["test"]);
  });

  it("correctly parses Identifier value", () => {
    [1, 255, 260, 4660, 63535].forEach((identifier) => {
      const fixedHeader = createUnsubscribeFixedHeader(5);
      const readerMock = createUnsubscribeReaderMock(
        [], // remaining values not needed
        identifier, // packet identifier
        ["/"] // topic filter: "test"
      );

      const packet = parseMqttPacketV4(
        fixedHeader,
        readerMock
      ) as UnsubscribePacketV4;

      expect(packet.identifier).toBe(identifier);
    });
  });

  // SUBSCRIBE, UNSUBSCRIBE, and PUBLISH (in cases where QoS > 0)
  // Control Packets MUST contain a non-zero 16-bit Packet Identifier
  // [MQTT-2.3.1-1]
  it("throws an Error when Identifier is invalid", () => {
    const fixedHeader = createUnsubscribeFixedHeader(5);
    const readerMock = createUnsubscribeReaderMock(
      [], // remaining values not needed
      0, // packet identifier
      ["/"] // topic filter: "test"
    );

    expect(() => parseMqttPacketV4(fixedHeader, readerMock)).toThrowError(
      /non-zero/
    );
  });

  // [MQTT-3.10.3-1]
  // The Topic Filters in an UNSUBSCRIBE packet MUST be UTF-8 encoded strings as defined in Section 1.5.3, packed contiguously.
  it(`throws an Error for invalid UTF-8 encoding in topic`, () => {
    const readerMock = createUnsubscribeReaderMock(
      [
        6, // initial remaining value
      ],
      1, // packet identifier
      [new Error("UTF-8")] // invalid UTF-8 topic
    );

    expect(() => parseMqttPacketV4(fixedHeader, readerMock)).toThrow(/UTF-8/);
  });

  // [MQTT-3.10.3-2]
  // The Payload of an UNSUBSCRIBE packet MUST contain at least one Topic Filter.
  // An UNSUBSCRIBE packet with no payload is a protocol violation.
  it(`throws an Error for empty topic filter list`, () => {
    const readerMock = createUnsubscribeReaderMock(
      [
        6, // initial remaining value
      ],
      1, // packet identifier
      [] // empty topic filter list
    );

    expect(() => parseMqttPacketV4(fixedHeader, readerMock)).toThrowError(
      /topic/
    );
  });

  it("correctly parses list of two topic filters", () => {
    const fixedHeader = createUnsubscribeFixedHeader(12);
    const readerMock = createUnsubscribeReaderMock(
      [
        10, // // remaining value after reading identifier
        6, // value after reading first topic filter
      ],
      1, // packet identifier
      ["t1", "t2/a"] // topic filter: "test"
    );

    const packet = parseMqttPacketV4(
      fixedHeader,
      readerMock
    ) as UnsubscribePacketV4;

    expect(packet.topicFilterList).toEqual(["t1", "t2/a"]);
  });

  it(`throws an Error for invalid first topic filter`, () => {
    const fixedHeader = createUnsubscribeFixedHeader(5);
    const error = getErrorMock("topic") as unknown as string;
    const readerMock = createUnsubscribeReaderMock(
      [
        5, // initial remaining value
      ],
      1, // packet identifier
      [error] // topic1 filter throws an error
    );

    expect(() => parseMqttPacketV4(fixedHeader, readerMock)).toThrow(/topic/);
  });

  it(`throws an Error for invalid second topic filter`, () => {
    const fixedHeader = createUnsubscribeFixedHeader(8);
    const error = getErrorMock("topic") as unknown as string;
    const readerMock = createUnsubscribeReaderMock(
      [
        8, // initial remaining value
        6, // value after reading identifier
      ],
      1, // packet identifier
      ["/", error] // topic1 filter
    );

    expect(() => parseMqttPacketV4(fixedHeader, readerMock)).toThrow(/topic/);
  });

  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  it(`throws an Error for zero-length topic name`, () => {
    const readerMock = createUnsubscribeReaderMock(
      [
        6, // initial remaining value
      ],
      1, // packet identifier
      [
        "", // zero-length topic name
      ]
    );

    expect(() => parseMqttPacketV4(fixedHeader, readerMock)).toThrow(
      /MQTT-4\.7\.3-1/
    );
  });

  // Topic Names and Topic Filters MUST NOT include the null character (Unicode U+0000).
  // [MQTT-4.7.3-2]
  it(`throws an Error for topic name containing null character`, () => {
    const readerMock = createUnsubscribeReaderMock(
      [
        6, // initial remaining value
      ],
      1, // packet identifier
      [
        new Error("null"), // invalid topic name
      ]
    );

    expect(() => parseMqttPacketV4(fixedHeader, readerMock)).toThrow(/null/);
  });
});
