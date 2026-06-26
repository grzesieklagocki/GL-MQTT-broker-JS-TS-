import { MqttPacketDecoder } from "@mqtt/protocol/shared/MqttPacketDecoder";
import { MqttPacketFramer } from "@mqtt/protocol/shared/MqttPacketFramer";
import { FixedHeader, PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { FixedHeaderParserV4 } from "@mqtt/protocol/v4/decoding/parsers/FixedHeaderParserV4";
import { parseMqttPacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parseMqttPacketV4";
import { AnyPacketV4, PublishPacketV4 } from "@mqtt/protocol/v4/types";
import { describe, expect, it } from "vitest";

describe("MqttPacketDecoder integration with MqttPacketFramer and FixedHeaderParserV4", () => {
  describe("single chunk", () => {
    it("decodes one packet with no payload", () => {
      const result = decodeSingleChunk([
        // PINGREQ
        0b1100_0000, 0x00,
      ]);

      expect(result.packets).toStrictEqual([
        {
          typeId: PacketType.PINGREQ,
        },
      ] as AnyPacketV4[]);

      expect(result.fixedHeaders).toStrictEqual([
        {
          packetType: PacketType.PINGREQ,
          flags: 0,
          remainingLength: 0,
        },
      ]);
    });

    it("decodes one packet with payload", () => {
      const result = decodeSingleChunk([
        // SUBACK
        0b1001_0000,
        // Remaining Length = 3
        0x03,
        // Packet Identifier = 10
        0x00, 0x0a,
        // Return Code = Success QoS 0
        0x00,
      ]);

      expect(result.packets).toStrictEqual([
        {
          typeId: PacketType.SUBACK,
          identifier: 10,
          returnCode: 0x00,
        },
      ] as AnyPacketV4[]);

      expect(result.fixedHeaders).toStrictEqual([
        {
          packetType: PacketType.SUBACK,
          flags: 0,
          remainingLength: 3,
        },
      ]);
    });

    it("decodes PUBLISH packet with QoS 0", () => {
      const result = decodeSingleChunk([
        // PUBLISH dup=false, qos=0, retain=true
        0b0011_0001,
        // Remaining Length = 9
        0x09,
        // Topic Name Length = 4
        0x00, 0x04,
        // Topic Name = "test"
        0x74, 0x65, 0x73, 0x74,
        // Application Message = "msg"
        0x6d, 0x73, 0x67,
      ]);

      expect(result.packets).toStrictEqual([
        {
          typeId: PacketType.PUBLISH,
          flags: {
            dup: false,
            qosLevel: 0,
            retain: true,
          },
          identifier: undefined,
          topicName: "test",
          applicationMessage: new Uint8Array([0x6d, 0x73, 0x67]),
        },
      ] as AnyPacketV4[]);
    });

    it("decodes two packets from one chunk", () => {
      const result = decodeSingleChunk([
        // DISCONNECT
        0b1110_0000, 0x00,

        // PINGRESP
        0b1101_0000, 0x00,
      ]);

      expect(result.packets).toStrictEqual([
        {
          typeId: PacketType.DISCONNECT,
        },
        {
          typeId: PacketType.PINGRESP,
        },
      ] as AnyPacketV4[]);

      expect(result.fixedHeaders).toStrictEqual([
        {
          packetType: PacketType.DISCONNECT,
          flags: 0,
          remainingLength: 0,
        },
        {
          packetType: PacketType.PINGRESP,
          flags: 0,
          remainingLength: 0,
        },
      ]);
    });

    it("decodes two packets with payload from one chunk", () => {
      const result = decodeSingleChunk([
        // SUBACK
        0b1001_0000,
        // Remaining Length = 3
        0x03,
        // Packet Identifier = 10
        0x00, 0x0a,
        // Return Code = Success QoS 0
        0x00,

        // PUBLISH dup=false, qos=1, retain=true
        0b0011_0011,
        // Remaining Length = 11
        0x0b,
        // Topic Name Length = 4
        0x00, 0x04,
        // Topic Name = "test"
        0x74, 0x65, 0x73, 0x74,
        // Packet Identifier = 9
        0x00, 0x09,
        // Application Message = "msg"
        0x6d, 0x73, 0x67,
      ]);

      expect(result.packets).toStrictEqual([
        {
          typeId: PacketType.SUBACK,
          identifier: 10,
          returnCode: 0x00,
        },
        {
          typeId: PacketType.PUBLISH,
          flags: {
            dup: false,
            qosLevel: 1,
            retain: true,
          },
          identifier: 9,
          topicName: "test",
          applicationMessage: new Uint8Array([0x6d, 0x73, 0x67]),
        },
      ] as AnyPacketV4[]);
    });
  });

  describe("multiple chunks", () => {
    it("does not emit packet until full packet is available", () => {
      const packetsByWrite = decodeChunks([
        // PINGREQ split into fixed header byte and remaining length byte
        [0b1100_0000],
        [0x00],
      ]);

      expect(packetsByWrite).toStrictEqual([
        [],
        [
          {
            typeId: PacketType.PINGREQ,
          },
        ],
      ] as AnyPacketV4[][]);
    });

    it("handles empty chunks between packet fragments", () => {
      const packetsByWrite = decodeChunks([[0b1100_0000], [], [0x00]]);

      expect(packetsByWrite).toStrictEqual([
        [],
        [],
        [
          {
            typeId: PacketType.PINGREQ,
          },
        ],
      ] as AnyPacketV4[][]);
    });

    it("decodes packet with payload split across multiple chunks", () => {
      const packetsByWrite = decodeChunks([
        // PUBLISH dup=false, qos=0, retain=true
        [0b0011_0001, 0x09, 0x00],
        // Topic Name length continuation + "te"
        [0x04, 0x74, 0x65],
        // "st" + "msg"
        [0x73, 0x74, 0x6d, 0x73, 0x67],
      ]);

      expect(packetsByWrite).toStrictEqual([
        [],
        [],
        [
          {
            typeId: PacketType.PUBLISH,
            flags: {
              dup: false,
              qosLevel: 0,
              retain: true,
            },
            identifier: undefined,
            topicName: "test",
            applicationMessage: new Uint8Array([0x6d, 0x73, 0x67]),
          },
        ],
      ] as AnyPacketV4[][]);
    });

    it("decodes two packets split across multiple chunks", () => {
      const packetsByWrite = decodeChunks([
        // SUBACK partial
        [0b1001_0000, 0x03, 0x00, 0x02],
        // SUBACK return code + PUBLISH first byte
        [0x01, 0b0011_0011],
        // PUBLISH remaining length + topic length + first topic byte
        [0x0b, 0x00, 0x04, 0x74],
        // rest of topic + packet identifier partial
        [0x65, 0x73, 0x74, 0x00, 0x09],
        // payload
        [0x6d, 0x73, 0x67],
      ]);

      expect(packetsByWrite).toStrictEqual([
        [],
        [
          {
            typeId: PacketType.SUBACK,
            identifier: 2,
            returnCode: 0x01,
          },
        ],
        [],
        [],
        [
          {
            typeId: PacketType.PUBLISH,
            flags: {
              dup: false,
              qosLevel: 1,
              retain: true,
            },
            identifier: 9,
            topicName: "test",
            applicationMessage: new Uint8Array([0x6d, 0x73, 0x67]),
          },
        ],
      ] as AnyPacketV4[][]);
    });

    it("decodes PUBLISH with Remaining Length encoded as 2-byte VBI", () => {
      const { bytes, parsed } = createPublishPacket128();

      const packetsByWrite = decodeChunks([
        [bytes[0]],
        [bytes[1]],
        [bytes[2], ...bytes.slice(3)],
      ]);

      expect(packetsByWrite).toStrictEqual([
        [],
        [],
        [parsed],
      ] as AnyPacketV4[][]);
    });

    it("decodes PUBLISH with Remaining Length encoded as 2-byte VBI split into 1-byte chunks", () => {
      const { bytes, parsed } = createPublishPacket128();

      const input = bytes.map((byte) => [byte]);
      const packetsByWrite = decodeChunks(input);

      const expected = bytes.map(() => [] as AnyPacketV4[]);
      expected[expected.length - 1] = [parsed];

      expect(packetsByWrite).toStrictEqual(expected);
    });
  });

  describe("error handling", () => {
    it("propagates error for malformed Remaining Length encoded in more than 4 bytes", () => {
      const { decoder, packets, fixedHeaders } = createDecoderV4();

      expect(() =>
        decoder.write(
          new Uint8Array([
            // PUBLISH
            0b0011_0000,
            // malformed Remaining Length - too many continuation bytes
            0x80, 0x80, 0x80, 0x80, 0x00,
          ])
        )
      ).toThrow();

      expect(packets).toStrictEqual([]);
      expect(fixedHeaders).toStrictEqual([]);
    });
  });
});

function createDecoderV4(): {
  decoder: MqttPacketDecoder;
  packets: AnyPacketV4[];
  fixedHeaders: FixedHeader[];
} {
  const decoder = new MqttPacketDecoder(
    new MqttPacketFramer(new FixedHeaderParserV4()),
    (fixedHeader, restOfPacket) =>
      parseMqttPacketV4(
        fixedHeader,
        restOfPacket ? new MQTTReaderV4(restOfPacket) : undefined
      )
  );

  const packets: AnyPacketV4[] = [];
  const fixedHeaders: FixedHeader[] = [];

  decoder.onPacketFramed = (fixedHeader) => {
    fixedHeaders.push(fixedHeader);
  };

  decoder.onPacketParsed = (packet) => {
    packets.push(packet as AnyPacketV4);
  };

  return {
    decoder,
    packets,
    fixedHeaders,
  };
}

function decodeSingleChunk(data: number[]): {
  packets: AnyPacketV4[];
  fixedHeaders: FixedHeader[];
} {
  const { decoder, packets, fixedHeaders } = createDecoderV4();

  decoder.write(new Uint8Array(data));

  return {
    packets,
    fixedHeaders,
  };
}

function decodeChunks(chunks: number[][]): AnyPacketV4[][] {
  const { decoder, packets } = createDecoderV4();

  const packetsByWrite: AnyPacketV4[][] = [];

  for (const chunk of chunks) {
    const packetsCountBeforeWrite = packets.length;

    decoder.write(new Uint8Array(chunk));

    const packetsParsedDuringWrite = packets.slice(packetsCountBeforeWrite);
    packetsByWrite.push(packetsParsedDuringWrite);
  }

  return packetsByWrite;
}

// creates a PUBLISH packet with Remaining Length = 128 encoded as 2-byte VBI
function createPublishPacket128(): {
  bytes: number[];
  parsed: PublishPacketV4;
} {
  // PUBLISH dup=false, qos=0, retain=false
  const firstByte = 0b0011_0000;

  // Remaining Length = 128 => 0x80 0x01
  const remainingLength = [0x80, 0x01];

  // Topic Name = "a"
  const topic = [0x61];

  // Topic Name Length + Topic Name
  const variableHeader = [0x00, topic.length, ...topic];

  const payloadLength = 128 - variableHeader.length;
  const payload = new Array(payloadLength).fill(0x78);

  const bytes = [firstByte, ...remainingLength, ...variableHeader, ...payload];

  const parsed: PublishPacketV4 = {
    typeId: PacketType.PUBLISH,
    flags: {
      dup: false,
      qosLevel: 0,
      retain: false,
    },
    identifier: undefined,
    topicName: "a",
    applicationMessage: new Uint8Array(payload),
  };

  return {
    bytes,
    parsed,
  };
}
