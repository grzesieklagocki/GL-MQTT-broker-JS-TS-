import { PacketType } from "@mqtt/protocol/shared/types";
import { parseUnsubscribePacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parseUnsubscribePacketV4";
import { IMQTTReaderV4 } from "@src/mqtt/protocol/v4/types";
import { describe, it, expect } from "vitest";
import { createUnsubscribeReaderMock, getErrorMock } from "./mocks";

describe("parseUnsubscribePacketV4", () => {
  const readerMock = {} as unknown as IMQTTReaderV4;

  it(`parse UNSUBSCRIBE packet`, () => {
    const fixedHeader = {
      packetType: PacketType.UNSUBSCRIBE,
      flags: 0b0010,
      remainingLength: 8,
    };

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
      const fixedHeader = {
        packetType: invalidPacketType,
        flags: 0b0010,
        remainingLength: 9,
      };

      expect(() => parseUnsubscribePacketV4(fixedHeader, readerMock)).toThrow(
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

      expect(() => parseUnsubscribePacketV4(fixedHeader, readerMock)).toThrow(
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

      expect(() => parseUnsubscribePacketV4(fixedHeader, readerMock)).toThrow(
        /header/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (<5 in reader)`, () => {
    [0, 1, 2, 3, 4].forEach((remaining) => {
      const fixedHeader = {
        packetType: PacketType.UNSUBSCRIBE,
        flags: 0b0010,
        remainingLength: remaining,
      };
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
      const fixedHeader = {
        packetType: PacketType.UNSUBSCRIBE,
        flags: 0b0010,
        remainingLength: declared,
      };
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
      const fixedHeader = {
        packetType: PacketType.UNSUBSCRIBE,
        flags: 0b0010,
        remainingLength: 5,
      };

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
    const fixedHeader = {
      packetType: PacketType.UNSUBSCRIBE,
      flags: 0b0010,
      remainingLength: 5,
    };

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

  it("correctly parses list of two topic filters", () => {
    const fixedHeader = {
      packetType: PacketType.UNSUBSCRIBE,
      flags: 0b0010,
      remainingLength: 12,
    };

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
    const fixedHeader = {
      packetType: PacketType.UNSUBSCRIBE,
      flags: 0b0010,
      remainingLength: 5,
    };

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
    const fixedHeader = {
      packetType: PacketType.UNSUBSCRIBE,
      flags: 0b0010,
      remainingLength: 8,
    };

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
});
