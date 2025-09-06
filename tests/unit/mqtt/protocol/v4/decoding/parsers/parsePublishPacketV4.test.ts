import { PacketType } from "@mqtt/protocol/shared/types";
import { IMQTTReaderV4 } from "@src/mqtt/protocol/v4/types";
import { describe, it, expect } from "vitest";
import { createPublishReaderMock } from "./mocks";
import { parsePublishPacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parsePublishPacketV4";

describe("parsePublishPacketV4", () => {
  const readerMock = {} as unknown as IMQTTReaderV4;

  it(`parse PUBLISH packet`, () => {
    const fixedHeader = {
      packetType: PacketType.PUBLISH,
      flags: 0b1010,
      remainingLength: 9,
    };

    const message = new Uint8Array([0, 1, 2]);
    const readerMock = createPublishReaderMock(
      [
        9, // initial remaining value
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
      const fixedHeader = {
        packetType: invalidPacketType,
        flags: 0b0010,
        remainingLength: 9,
      };

      expect(() => parsePublishPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet type/
      );
    });
  });
});
