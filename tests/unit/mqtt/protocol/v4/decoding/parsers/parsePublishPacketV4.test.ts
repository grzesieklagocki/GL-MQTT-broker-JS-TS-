import { PacketType } from "@mqtt/protocol/shared/types";
import { IMQTTReaderV4 } from "@mqtt/protocol/v4/types";
import { describe, it, expect } from "vitest";
import { createPublishReaderMock } from "./mocks";
import { parsePublishPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parsePublishPacketV4";
import { AppError } from "@src/AppError";
import {
  createFixedHeader,
  createPublishFixedHeader,
} from "tests/helpers/mqtt/protocol/createFixedHeader";

describe("parsePublishPacketV4", () => {
  // commonly used fixed header for PUBLISH packet
  const fixedHeader = createPublishFixedHeader(8, 0b0010);

  // commonly used reader mock for PUBLISH packet
  const readerMock = {} as unknown as IMQTTReaderV4;

  it(`parse PUBLISH packet (QoS 0)`, () => {
    const fixedHeader = createPublishFixedHeader(
      9, // remaining length
      0b0000 // QoS 0
    );
    const message = new Uint8Array([0, 1, 2]);
    const readerMock = createPublishReaderMock(
      [
        9, // initial remaining value
        5, // after reading topic name
        3, // before read message
        0, // after parsing
      ],
      "t1", // topic name
      undefined, // packet identifier
      message // message
    );

    const packet = parsePublishPacketV4(fixedHeader, readerMock);

    expect(packet.typeId).toBe(PacketType.PUBLISH);

    expect(packet.flags.dup).toBe(false);
    expect(packet.flags.qosLevel).toBe(0);
    expect(packet.flags.retain).toBe(false);

    expect(packet.topicName).toBe("t1");
    expect(packet.identifier).toBe(undefined);
    expect(packet.applicationMessage).toEqual(message);

    expect(readerMock.readString).toHaveBeenCalledOnce(); // topic name
    expect(readerMock.readTwoByteInteger).not.toHaveBeenCalled(); // identifier
    expect(readerMock.readBytes).toHaveBeenCalledOnce(); // message
    expect(readerMock.readOneByteInteger).not.toBeCalled(); // unused
  });

  it(`parse PUBLISH packet (QoS > 0)`, () => {
    const fixedHeader = createPublishFixedHeader(
      9, // remaining length
      0b1010 // DUP flag set, QoS 1
    );

    const message = new Uint8Array([0, 1, 2]);
    const readerMock = createPublishReaderMock(
      [
        9, // initial remaining value
        5, // after parsing topic name
        3, // before read message
        0, // after parsing
      ],
      "t1", // topic name
      0x0105, // packet identifier
      message // message
    );

    const packet = parsePublishPacketV4(fixedHeader, readerMock);

    expect(packet.typeId).toBe(PacketType.PUBLISH);

    expect(packet.flags.dup).toBe(true);
    expect(packet.flags.qosLevel).toBe(1);
    expect(packet.flags.retain).toBe(false);

    expect(packet.topicName).toBe("t1");
    expect(packet.identifier).toBe(0x0105);
    expect(packet.applicationMessage).toEqual(message);

    expect(readerMock.readString).toHaveBeenCalledOnce(); // topic name
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // identifier
    expect(readerMock.readBytes).toHaveBeenCalledOnce(); // message
    expect(readerMock.readOneByteInteger).not.toBeCalled(); // unused
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
      const fixedHeader = createFixedHeader(invalidPacketType, 0b0010, 7);

      expect(() => parsePublishPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet type/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (declared in fixed header)`, () => {
    [0, 1, 2].forEach((invalidRemainingLength) => {
      const fixedHeader = createPublishFixedHeader(
        invalidRemainingLength, // remaining length
        0b0000 // QoS 0
      );

      expect(() => parsePublishPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet remaining length/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [0, 1, 2].forEach((remaining) => {
      const fixedHeader = createPublishFixedHeader(
        7, // remaining length
        0b0000 // QoS 0
      );
      const readerMock = {
        remaining: remaining,
      } as unknown as IMQTTReaderV4;

      expect(() => parsePublishPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet remaining length in reader/
      );
    });
  });

  // SUBSCRIBE, UNSUBSCRIBE, and PUBLISH (in cases where QoS > 0) Control Packets MUST contain a non-zero 16-bit Packet Identifier
  // [MQTT-2.3.1-1]
  it(`throws an Error for zero packet identifier when QoS > 0`, () => {
    [0b01, 0b10].forEach((qos) => {
      const fixedHeader = createPublishFixedHeader(
        7, // remaining length
        0b0110 & (qos << 1) // QoS 1 or 2
      );
      const readerMock = createPublishReaderMock(
        [
          7, // initial remaining value
          4, // after reading topic name
          0, // after parsing
        ],
        "t", // topic name
        0x0000 // packet identifier
      );

      expect(() => parsePublishPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet identifier/
      );

      expect(readerMock.readString).toHaveBeenCalledOnce(); // topic name
      expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // identifier
      expect(readerMock.readBytes).not.toBeCalled(); // message
      expect(readerMock.readOneByteInteger).not.toBeCalled(); // unused
    });
  });

  // A PUBLISH Packet MUST NOT contain a Packet Identifier if its QoS value is set to 0
  // [MQTT-2.3.1-5]
  it(`throws an Error for packet identifier present when QoS is 0`, () => {
    const fixedHeader = createPublishFixedHeader(
      7, // remaining length
      0b0000 // QoS 0
    );
    const readerMock = createPublishReaderMock(
      [
        7, // initial remaining value
        4, // after parsing topic name
        2, // after parsing
      ],
      "t", // topic name
      0xff, // packet identifier
      new Uint8Array() // message
    );

    // if qos is 0, identifier is not read,
    // so two bytes should remain in reader
    expect(() => parsePublishPacketV4(fixedHeader, readerMock)).toThrow(
      /unread/
    );

    expect(readerMock.readString).toHaveBeenCalledOnce(); // topic name
    expect(readerMock.readTwoByteInteger).not.toBeCalled(); // identifier
    expect(readerMock.readBytes).toHaveBeenCalledOnce(); // message
    expect(readerMock.readOneByteInteger).not.toBeCalled(); // unused
  });

  // The DUP flag MUST be set to 0 for all QoS 0 messages
  // [MQTT-3.3.1-2]
  it(`throws an Error for invalid DUP flag`, () => {
    const fixedHeader = createPublishFixedHeader(
      7, // remaining length
      0b1000 // invalid DUP flag for QoS 0
    );

    const readerMock = {
      remaining: 7,
    } as unknown as IMQTTReaderV4;

    expect(() => parsePublishPacketV4(fixedHeader, readerMock)).toThrow(
      /DUP flag/
    );
  });

  // A PUBLISH Packet MUST NOT have both QoS bits set to 1.
  // If a Server or Client receives a PUBLISH Packet which has both QoS bits set to 1 it MUST close the Network Connection
  // [MQTT-3.3.1-4]
  it(`throws an Error for invalid QoS flags`, () => {
    const fixedHeader = createPublishFixedHeader(
      7, // remaining length
      0b0110 // // invalid QoS (0b11)
    );
    const readerMock = {
      remaining: 7,
    } as unknown as IMQTTReaderV4;

    expect(() => parsePublishPacketV4(fixedHeader, readerMock)).toThrow(
      /Invalid QoS flags/
    );
  });

  // The Topic Name MUST be present as the first field in the PUBLISH Packet Variable header.
  // It MUST be a UTF-8 encoded string
  // [MQTT-3.3.2-1]
  it(`throws an Error for invalid topic name`, () => {
    const readerMock = createPublishReaderMock(
      [
        8, // initial remaining value
        0, // after parsing
      ],
      new AppError("UTF-8"), // invalid topic name
      0x0105, // packet identifier
      new Uint8Array() // message
    );

    expect(() => parsePublishPacketV4(fixedHeader, readerMock)).toThrow(
      /UTF-8/
    );

    expect(readerMock.readString).toHaveBeenCalledOnce(); // topic name
    expect(readerMock.readTwoByteInteger).not.toBeCalled(); // identifier
    expect(readerMock.readBytes).not.toBeCalled(); // message
    expect(readerMock.readOneByteInteger).not.toBeCalled(); // unused
  });

  // The Topic Name in the PUBLISH Packet MUST NOT contain wildcard characters
  // [MQTT-3.3.2-2]
  it(`throws an Error for topic name containing wildcard characters`, () => {
    ["t/+", "t/#", "+/t", "#/t", "t/#/t", "t/+/t"].forEach((invalidTopic) => {
      const readerMock = createPublishReaderMock(
        [
          8, // initial remaining value
          0, // after parsing
        ],
        invalidTopic, // invalid topic name
        0x0105, // packet identifier
        new Uint8Array() // message
      );

      expect(() => parsePublishPacketV4(fixedHeader, readerMock)).toThrow(
        /wildcard/
      );

      expect(readerMock.readString).toHaveBeenCalledOnce(); // topic name
      expect(readerMock.readTwoByteInteger).not.toBeCalled(); // identifier
      expect(readerMock.readBytes).not.toBeCalled(); // message
      expect(readerMock.readOneByteInteger).not.toBeCalled(); // unused
    });
  });

  // All Topic Names and Topic Filters MUST be at least one character long.
  // [MQTT-4.7.3-1]
  it(`throws an Error for zero-length topic name`, () => {
    const readerMock = createPublishReaderMock(
      [
        8, // initial remaining value
        0, // after parsing
      ],
      "" // invalid topic name
    );

    expect(() => parsePublishPacketV4(fixedHeader, readerMock)).toThrow(
      /Invalid topic length/
    );

    expect(readerMock.readString).toHaveBeenCalledOnce(); // topic name
    expect(readerMock.readTwoByteInteger).not.toBeCalled(); // identifier
    expect(readerMock.readBytes).not.toBeCalled(); // message
    expect(readerMock.readOneByteInteger).not.toBeCalled(); // unused
  });

  // Topic Names and Topic Filters MUST NOT include the null character (Unicode U+0000).
  // [MQTT-4.7.3-2]
  it(`throws an Error for topic name containing null character`, () => {
    const readerMock = createPublishReaderMock(
      [
        8, // initial remaining value
        0, // after parsing
      ],
      new Error("null") // invalid topic name
    );

    expect(() => parsePublishPacketV4(fixedHeader, readerMock)).toThrow(/null/);
  });
});
