import { PacketType, QoS } from "@mqtt/protocol/shared/types";
import { parseSubscribePacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parseSubscribePacketV4";
import { IMQTTReaderV4 } from "@src/mqtt/protocol/v4/types";
import { describe, it, expect } from "vitest";
import { createSubscribeReaderMock, getErrorMock } from "./mocks";

describe("parseSubscribePacketV4", () => {
  const readerMock = {} as unknown as IMQTTReaderV4;

  it(`parse SUBSCRIBE packet`, () => {
    const fixedHeader = {
      packetType: PacketType.SUBSCRIBE,
      flags: 0b0010,
      remainingLength: 9,
    };

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
      const fixedHeader = {
        packetType: invalidPacketType,
        flags: 0b0010,
        remainingLength: 9,
      };

      expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
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

      expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
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

      expect(() => parseSubscribePacketV4(fixedHeader, readerMock)).toThrow(
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
      const fixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0010,
        remainingLength: declared,
      };
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
      const fixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0010,
        remainingLength: 6,
      };

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

  it("throws an Error when Identifier is invalid", () => {
    const fixedHeader = {
      packetType: PacketType.SUBSCRIBE,
      flags: 0b0010,
      remainingLength: 6,
    };
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
    const fixedHeader = {
      packetType: PacketType.SUBSCRIBE,
      flags: 0b0010,
      remainingLength: 12,
    };

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
    const fixedHeader = {
      packetType: PacketType.SUBSCRIBE,
      flags: 0b0010,
      remainingLength: 6,
    };

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
    const fixedHeader = {
      packetType: PacketType.SUBSCRIBE,
      flags: 0b0010,
      remainingLength: 10,
    };

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

  it(`throws an Error for invalid QoS of first subscription`, () => {
    [3, 4, 7, 255].forEach((invalidQoS) => {
      const fixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0010,
        remainingLength: 6,
      };

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
      const fixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0010,
        remainingLength: 10,
      };

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
});
