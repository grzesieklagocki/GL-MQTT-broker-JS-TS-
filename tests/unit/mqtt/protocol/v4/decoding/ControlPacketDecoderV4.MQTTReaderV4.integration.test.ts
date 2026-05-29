import { PacketType } from "@src/mqtt/protocol/shared/types";
import { ControlPacketDecoderV4 } from "@src/mqtt/protocol/v4/decoding/ControlPacketDecoderV4";
import { AnyPacketV4, PublishPacketV4 } from "@src/mqtt/protocol/v4/types";
import { describe, it, expect } from "vitest";

describe("ControlPacketDecoderV4.decode", () => {
  describe("decode data in single chunk", () => {
    it("decodes one packet with no payload", () => {
      const array = [0b1110_0000, 0x00]; // DISCONNECT packet
      const expected = [{ typeId: PacketType.DISCONNECT }] as AnyPacketV4[];

      testDecoding(array, expected);
    });

    it("decodes one packet with payload", () => {
      [
        {
          array: [
            // SUBACK packet
            0b1001_0000,
            // Remaining Length = 3
            0x03,
            // Packet Identifier (10)
            0x00,
            // Return Code (Success - QoS 0)
            0x0a, 0x00,
          ],
          expected: [
            {
              typeId: PacketType.SUBACK,
              identifier: 0x0a,
              returnCode: 0x00,
            },
          ] as AnyPacketV4[],
        },
        {
          array: [
            // PUBLISH packet (dup=false, qos=0, retain=true)
            0b0011_0001,
            // Remaining Length = 9
            0x09,
            // Topic Name Length (4)
            0x00, 0x04,
            // Topic Name ("test")
            0x74, 0x65, 0x73, 0x74,
            // Application Message ("msg")
            0x6d, 0x73, 0x67,
          ],
          expected: [
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
          ] as AnyPacketV4[],
        },
      ].forEach(({ array, expected }) => {
        testDecoding(array, expected);
      });
    });

    it("decodes two packets with no payload", () => {
      const array = [
        // DISCONNECT packet
        0b1110_0000, 0x00,
        // PINGRESP packet
        0b1101_0000, 0x00,
      ];

      const expected = [
        { typeId: PacketType.DISCONNECT },
        { typeId: PacketType.PINGRESP },
      ] as AnyPacketV4[];

      testDecoding(array, expected);
    });

    it("decodes two packets with payload", () => {
      const array = [
        // SUBACK packet
        0b1001_0000,
        // Remaining Length = 3
        0x03,
        // Packet Identifier (10)
        0x00,
        // Return Code (Success - QoS 0)
        0x0a, 0x00,
        // PUBLISH packet (dup=false, qos=0, retain=true)
        0b0011_0011,
        // Remaining Length = 11
        0x0b,
        // Topic Name Length (4)
        0x00, 0x04,
        // Topic Name ("test")
        0x74, 0x65, 0x73, 0x74,
        // identifier (9)
        0x00, 0x09,
        // Application Message ("msg")
        0x6d, 0x73, 0x67,
      ];

      const expected = [
        {
          typeId: PacketType.SUBACK,
          identifier: 0x0a,
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
      ] as AnyPacketV4[];

      testDecoding(array, expected);
    });
  });

  describe("decode data in multiple chunks", () => {
    it("decodes one packet (with no payload) split into multiple chunks", () => {
      [
        // PINGREQ
        {
          input: [[0b1100_0000], [0x00]],
          expected: [[], [{ typeId: PacketType.PINGREQ }]] as AnyPacketV4[][],
        },
        {
          // PINGREQ (different split)
          input: [[0b1100_0000, 0x00], []],
          expected: [[{ typeId: PacketType.PINGREQ }], []] as AnyPacketV4[][],
        },
        {
          // PINGREQ (another split)
          input: [[], [0b1100_0000, 0x00]],
          expected: [[], [{ typeId: PacketType.PINGREQ }]] as AnyPacketV4[][],
        },
        {
          // PINGREQ (another split with empty chunk in between)
          input: [[0b1100_0000], [], [0x00]],
          expected: [
            [],
            [],
            [{ typeId: PacketType.PINGREQ }],
          ] as AnyPacketV4[][],
        },
      ].forEach((testCase) => {
        testDecodingFromMultipleChunks(testCase);
      });
    });

    it("decodes one packet (with payload) split into multiple chunks", () => {
      [
        {
          input: [
            // SUBACK packet
            [0b1001_0000],
            // Remaining Length = 3
            [0x03],
            // Packet Identifier (12) + Return Code (Success - QoS 2)
            [0x00, 0x0c, 0x02],
          ],
          expected: [
            [],
            [],
            [
              {
                typeId: PacketType.SUBACK,
                identifier: 0x0c,
                returnCode: 0x02,
              },
            ],
          ] as AnyPacketV4[][],
        },
        {
          input: [
            // PUBLISH packet (retain=true, qos=0, dup=false)
            [0b0011_0001, 0x09, 0x00],
            // Topic Name ("tes")
            [0x04, 0x74, 0x65],
            // Topic Name ... ("t") + Application Message ("msg")
            [0x73, 0x74, 0x6d, 0x73, 0x67],
          ],
          expected: [
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
                applicationMessage: new Uint8Array([109, 115, 103]),
              },
            ],
          ] as AnyPacketV4[][],
        },
      ].forEach((testCase) => {
        testDecodingFromMultipleChunks(testCase);
      });
    });

    it("decodes two packets (with no payload) split into two chunks", () => {
      [
        {
          input: [
            // DISCONNECT + PINGRESP packets
            [0b1110_0000],
            [0x00, 0b1101_0000, 0x00],
          ],
          expected: [
            [], // no packet yet
            [
              { typeId: PacketType.DISCONNECT },
              { typeId: PacketType.PINGRESP },
            ],
          ] as AnyPacketV4[][],
        },
        {
          input: [
            // DISCONNECT + PINGRESP packets (different split)
            [0b1110_0000, 0x00, 0b1101_0000],
            [0x00],
          ],
          expected: [
            [{ typeId: PacketType.DISCONNECT }],
            [{ typeId: PacketType.PINGRESP }],
          ] as AnyPacketV4[][],
        },
        {
          input: [
            // DISCONNECT + PINGRESP packets (another split with empty chunk in between)
            [0b1110_0000, 0x00, 0b1101_0000],
            [],
            [0x00],
          ],
          expected: [
            [{ typeId: PacketType.DISCONNECT }],
            [],
            [{ typeId: PacketType.PINGRESP }],
          ] as AnyPacketV4[][],
        },
      ].forEach((testCase) => {
        testDecodingFromMultipleChunks(testCase);
      });
    });

    it("decodes two packets (with payload) split into multiple chunks", () => {
      const testCase = {
        input: [
          // SUBACK + PUBLISH packets
          [0b1001_0000, 0x03, 0x00, 0x02],
          [0x01, 0b0011_0011],
          [0x0b, 0x00, 0x04, 0x74],
          [0x65, 0x73, 0x74, 0x00, 0x09],
          [0x6d, 0x73, 0x67],
        ],
        expected: [
          [], // no packet yet
          [
            {
              typeId: PacketType.SUBACK,
              identifier: 0x02,
              returnCode: 0x01,
            },
          ],
          [], // no packet yet
          [], // no packet yet
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
          ] as AnyPacketV4[],
        ] as AnyPacketV4[][],
      };
      testDecodingFromMultipleChunks(testCase);
    });

    it("decodes PUBLISH with Remaining Length encoded as 2-byte VBI (128) split in various ways", () => {
      const { bytes, parsed } = createPublishPacket128();

      // Break the packet into segments targeting the VBI:
      // fullPacket = [firstByte, 0x80, 0x01, ...rest]
      const firstByte = [bytes[0]];
      const vbiByte1 = [bytes[1]]; // 0x80
      const vbiByte2 = [bytes[2]]; // 0x01
      const rest = bytes.slice(3);

      const testCases: multipleChunksTestCase[] = [
        // split: [firstByte], [vbi1], [vbi2 + rest]
        {
          input: [firstByte, vbiByte1, [vbiByte2[0], ...rest]],
          expected: [[], [], [parsed]],
        },
        // split: [firstByte + vbi1], [vbi2], [rest]
        {
          input: [[firstByte[0], vbiByte1[0]], vbiByte2, rest],
          expected: [[], [], [parsed]],
        },
        // split: [firstByte], [vbi1 + vbi2], [rest]
        {
          input: [firstByte, [vbiByte1[0], vbiByte2[0]], rest],
          expected: [[], [], [parsed]],
        },
        // split with empty chunks in the middle
        {
          input: [firstByte, [], [vbiByte1[0]], [], [vbiByte2[0], ...rest]],
          expected: [[], [], [], [], [parsed]],
        },
      ];

      testCases.forEach((testCase) => testDecodingFromMultipleChunks(testCase));
    });

    it("decodes PUBLISH (Remaining Length=128, 2-byte VBI) when split into 1-byte chunks", () => {
      const { bytes, parsed } = createPublishPacket128();
      const input = bytes.map((b) => [b]); // 1 byte per chunk
      const expected: AnyPacketV4[][] = bytes.map(() => []);
      const lastIndex = expected.length - 1;
      expected[lastIndex] = [parsed];

      const testCase: multipleChunksTestCase = { input, expected };

      testDecodingFromMultipleChunks(testCase);
    });
  });
});

//
// Helper functions
//

// tests decoding of a single chunk
function testDecoding(
  dataChunk: number[],
  expected: AnyPacketV4[],
  decoder: ControlPacketDecoderV4 = new ControlPacketDecoderV4()
): void {
  const chunk = new Uint8Array(dataChunk);
  const packets = decoder.decode(chunk);

  expect(packets).toStrictEqual(expected);
}

type multipleChunksTestCase = { input: number[][]; expected: AnyPacketV4[][] };

// tests decoding from multiple chunks
function testDecodingFromMultipleChunks(testCase: multipleChunksTestCase) {
  const decoder = new ControlPacketDecoderV4();

  for (let i = 0; i < testCase.input.length; i++)
    testDecoding(testCase.input[i], testCase.expected[i], decoder);
}

// creates a PUBLISH packet with Remaining Length = 128 (encoded as 2-byte VBI)
function createPublishPacket128(): {
  bytes: any[];
  parsed: PublishPacketV4;
} {
  // Fixed header byte for PUBLISH: 0b0011_0000
  // flags: dup=false qos=0 retain=false -> 0b0011_0000
  const firstByte = 0b0011_0000;

  // Remaining Length = 128 => VBI: 0x80 0x01
  const remainingLength = [0x80, 0x01];

  // Variable header:
  // Topic length = 1, topic = "a"
  const topic = [0x61]; // "a"
  const variableHeader = [0x00, topic.length, topic]; // 0x00 0x01 0x61

  const payloadLength = 128 - variableHeader.length;
  const payload = new Array(payloadLength).fill(0x78); // "x"

  const bytes = [firstByte, ...remainingLength, ...variableHeader, ...payload];
  const parsed: AnyPacketV4 = {
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

  return { bytes, parsed };
}
