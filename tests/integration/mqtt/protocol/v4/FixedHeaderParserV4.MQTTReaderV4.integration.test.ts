import { FixedHeader } from "@mqtt/protocol/shared/types";
import { FixedHeaderParserV4 } from "@mqtt/protocol/v4/decoding/parsers/FixedHeaderParserV4";
import { describe, it, expect } from "vitest";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";

//
// integration tests for FixedHeaderParserV4 using MQTTReaderV4 with data buffers
//

describe("FixedHeaderParserV4", () => {
  describe("parse", () => {
    it("takes only Fixed Header bytes from reader", () => {
      [
        { packet: [0b1100_0000, 0x00], shouldRemain: 0 }, // PINGREQ packet with remaining length 0
        { packet: [0b0011_0000, 0x03, 0x00, 0x04, 0x54], shouldRemain: 3 }, // PUBLISH packet with remaining length 3
        {
          // SUBSCRIBE packet with remaining length 7
          packet: [0b1000_0010, 0x07, 0x00, 0x01, 0x00, 0x03, 0x61, 0x2f, 0x62],
          shouldRemain: 7,
        },
      ].forEach(({ packet, shouldRemain }) => {
        const reader = readerFrom(packet);
        const parser = new FixedHeaderParserV4();

        const fixedHeader = parser.parse(reader);

        expect(fixedHeader).not.toBeNull();
        expect(reader.remaining).toBe(shouldRemain);
      });
    });

    describe("Packet Type", () => {
      it("parses all supported Packet Types (MQTT 3.1.1)", () => {
        [
          // 1) CONNECT
          [0b0001_0000, 12],
          // 2) CONNACK
          [0b0010_0000, 2],
          // 3) PUBLISH (DUP=0, QoS=0, RETAIN=0)
          [0b0011_0000, 3],
          // 4) PUBACK
          [0b0100_0000, 2],
          // 5) PUBREC
          [0b0101_0000, 2],
          // 6) PUBREL
          [0b0110_0010, 2],
          // 7) PUBCOMP
          [0b0111_0000, 2],
          // 8) SUBSCRIBE
          [0b1000_0010, 6],
          // 9) SUBACK
          [0b1001_0000, 3],
          // 10) UNSUBSCRIBE
          [0b1010_0010, 5],
          // 11) UNSUBACK
          [0b1011_0000, 2],
          // 12) PINGREQ
          [0b1100_0000, 0],
          // 13) PINGRESP
          [0b1101_0000, 0],
          // 14) DISCONNECT
          [0b1110_0000, 0],
        ].forEach((packet) => {
          const reader = readerFrom(packet);
          const parser = new FixedHeaderParserV4();

          const fixedHeader = parser.parse(reader);

          expect(fixedHeader).not.toBeNull();
          expect(fixedHeader?.packetType).toBe(packet[0] >> 4);
        });
      });
      it("throws when Packet Type is reserved (MQTT 3.1.1)", () => {
        // Invalid Packet Types: 0 and 15
        [[0b0000_0000], [0b1111_0000]].forEach((packet) => {
          const reader = readerFrom(packet);
          const parser = new FixedHeaderParserV4();

          expect(() => parser.parse(reader)).toThrow(/Packet Type/);
        });
      });
    });

    describe("Flags", () => {
      it("parses Flags when valid for given Packet Type (for all packet types)", () => {
        [
          // 1) CONNECT
          [0b0001_0000, 12],
          // 2) CONNACK
          [0b0010_0000, 2],
          // 3) PUBLISH (DUP=0, QoS=0, RETAIN=0)
          [0b0011_0000, 3],
          // 4) PUBACK
          [0b0100_0000, 2],
          // 5) PUBREC
          [0b0101_0000, 2],
          // 6) PUBREL
          [0b0110_0010, 2],
          // 7) PUBCOMP
          [0b0111_0000, 2],
          // 8) SUBSCRIBE
          [0b1000_0010, 6],
          // 9) SUBACK
          [0b1001_0000, 3],
          // 10) UNSUBSCRIBE
          [0b1010_0010, 5],
          // 11) UNSUBACK
          [0b1011_0000, 2],
          // 12) PINGREQ
          [0b1100_0000, 0],
          // 13) PINGRESP
          [0b1101_0000, 0],
          // 14) DISCONNECT
          [0b1110_0000, 0],
        ].forEach((packet) => {
          const reader = readerFrom(packet);
          const parser = new FixedHeaderParserV4();

          const fixedHeader = parser.parse(reader);

          expect(fixedHeader).not.toBeNull();
          expect(fixedHeader?.flags).toBe(packet[0] & 0x0f);
        });
      });

      it("throws when Flags are invalid for given Packet Type (for all packet types)", () => {});
    });

    describe("Remaining Length", () => {
      it("correctly parses Variable Byte Integer encodings (1..4 bytes)", () => {
        [
          // --- 1 byte (0..127) ---
          { input: [0x00], expected: 0x00 }, // 0 (min 1-byte)
          { input: [0x03], expected: 0x03 }, // 3
          { input: [0x2a], expected: 0x2a }, // 42
          { input: [0x40], expected: 0x40 }, // 64
          { input: [0x50], expected: 0x50 }, // 80
          { input: [0x7e], expected: 0x7e }, // 126
          { input: [0x7f], expected: 0x7f }, // 127 (max 1-byte)
          // --- 2 bytes (128..16383) ---
          { input: [0x80, 0x01], expected: 0x0080 }, // 128 (min 2-byte)
          { input: [0x81, 0x01], expected: 0x0081 }, // 129
          { input: [0xc8, 0x01], expected: 0x00c8 }, // 200
          { input: [0xff, 0x01], expected: 0x00ff }, // 255
          { input: [0x80, 0x02], expected: 0x0100 }, // 256
          { input: [0xc1, 0x02], expected: 0x0141 }, // 321
          { input: [0xe8, 0x07], expected: 0x03e8 }, // 1000
          { input: [0x80, 0x20], expected: 0x1000 }, // 4096
          { input: [0x88, 0x27], expected: 0x1388 }, // 5000
          { input: [0x90, 0x4e], expected: 0x2710 }, // 10000
          { input: [0xfe, 0x7f], expected: 0x3ffe }, // 16382
          { input: [0xff, 0x7f], expected: 0x3fff }, // 16383 (max 2-byte)
          // --- 3 bytes (16384..2097151) ---
          { input: [0x80, 0x80, 0x01], expected: 0x004000 }, // 16384 (min 3-byte)
          { input: [0x81, 0x80, 0x01], expected: 0x004001 }, // 16385
          { input: [0xff, 0xff, 0x01], expected: 0x007fff }, // 32767
          { input: [0xc0, 0x9a, 0x0c], expected: 0x030d40 }, // 200000
          { input: [0xc5, 0xc6, 0x04], expected: 0x012345 }, // 0x12345
          { input: [0xde, 0xf9, 0x6a], expected: 0x1abcde }, // 0x1ABCDE
          { input: [0xfe, 0xff, 0x7f], expected: 0x1ffffe }, // 0x1FFFFE (max - 1)
          { input: [0xff, 0xff, 0x7f], expected: 0x1fffff }, // 2097151 (max 3-byte)
          // --- 4 bytes (2097152..268435455) ---
          { input: [0x80, 0x80, 0x80, 0x01], expected: 0x00200000 }, // 2097152 (min 4-byte)
          { input: [0x81, 0x80, 0x80, 0x01], expected: 0x00200001 }, // 2097153
          { input: [0xc0, 0x96, 0xb1, 0x02], expected: 0x004c4b40 }, // 5000000
          { input: [0x80, 0xad, 0xe2, 0x04], expected: 0x00989680 }, // 10000000
          { input: [0xfe, 0xff, 0xff, 0x7f], expected: 0x0ffffffe }, // 268435454 (max - 1)
          { input: [0xff, 0xff, 0xff, 0x7f], expected: 0x0fffffff }, // 268435455 (max 4-byte)
        ].forEach(({ input, expected }) => {
          const firstByte = input[0] >= 3 ? 0b0011_0000 : 0b1110_0000; // PUBLISH / DISCONNECT packet type with flags 0b0000
          const packet = [firstByte, ...input];
          const reader = readerFrom(packet);
          const parser = new FixedHeaderParserV4();

          const fixedHeader = parser.parse(reader);

          expect(fixedHeader).not.toBeNull();
          expect(fixedHeader?.packetType).toBe(firstByte >> 4);
          expect(fixedHeader?.flags).toBe(0b0000);
          expect(fixedHeader?.remainingLength).toBe(expected);
        });
      });

      it("throws for invalid Variable Byte Integer encodings", () => {
        [
          [0xff, 0xff, 0xff, 0x80], // missing 5th byte
          [0x80, 0x80, 0x80, 0x80], // msb=1 on last byte
          [0x80, 0x80, 0x80, 0x80, 0x00], // too many bytes
        ].forEach((input) => {
          const packet = [0b0011_0000, ...input]; // PUBLISH packet type with flags 0b0000
          const reader = readerFrom(packet);
          const parser = new FixedHeaderParserV4();

          expect(() => parser.parse(reader)).toThrow(/Malformed/);
        });
      });

      it("parses Remaining Length when valid for given Packet Type (for all packet types)", () => {
        const validCases: readonly [number, readonly number[]][] = [
          // 1) CONNECT (at least 12 bytes)
          [0b0001_0000, [12, 29, 46, 100, 127]],
          // 2) CONNACK (2 bytes)
          [0b0010_0000, [2]],
          // 3) PUBLISH (at least 3 bytes)
          [0b0011_0000, [3, 76, 99, 122]],
          // 4) PUBACK (2 bytes)
          [0b0100_0000, [2]],
          // 5) PUBREC (2 bytes)
          [0b0101_0000, [2]],
          // 6) PUBREL (2 bytes)
          [0b0110_0010, [2]],
          // 7) PUBCOMP (2 bytes)
          [0b0111_0000, [2]],
          // 8) SUBSCRIBE (at least 6 bytes)
          [0b1000_0010, [6, 13, 127]],
          // 9) SUBACK (3 bytes)
          [0b1001_0000, [3]],
          // 10) UNSUBSCRIBE (at least 5 bytes)
          [0b1010_0010, [5, 6, 10, 116]],
          // 11) UNSUBACK (2 bytes)
          [0b1011_0000, [2]],
          // 12) PINGREQ (0 bytes)
          [0b1100_0000, [0]],
          // 13) PINGRESP (0 bytes)
          [0b1101_0000, [0]],
          // 14) DISCONNECT (0 bytes)
          [0b1110_0000, [0]],
        ];

        validCases.forEach(([firstByte, validLengths]) => {
          validLengths.forEach((validLength) => {
            const packet = [firstByte, validLength];
            const reader = readerFrom(packet);
            const parser = new FixedHeaderParserV4();

            const fixedHeader = parser.parse(reader);

            expect(fixedHeader).not.toBeNull();
            expect(fixedHeader?.remainingLength).toBe(validLength);
          });
        });
      });

      it("throws when Remaining Length is invalid (for all packet types)", () => {
        const invalidCases: readonly [number, readonly number[]][] = [
          // 1) CONNECT (at least 12 bytes)
          [0b0001_0000, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]],
          // 2) CONNACK (2 bytes)
          [0b0010_0000, [0, 1, 3, 4]],
          // 3) PUBLISH (at least 3 bytes)
          [0b0011_0000, [0, 1, 2]],
          // 4) PUBACK (2 bytes)
          [0b0100_0000, [0, 1, 3, 4]],
          // 5) PUBREC (2 bytes)
          [0b0101_0000, [0, 1, 3, 4]],
          // 6) PUBREL (2 bytes)
          [0b0110_0010, [0, 1, 3, 4]],
          // 7) PUBCOMP (2 bytes)
          [0b0111_0000, [0, 1, 3, 4]],
          // 8) SUBSCRIBE (at least 6 bytes)
          [0b1000_0010, [0, 1, 2, 3, 4, 5]],
          // 9) SUBACK (3 bytes)
          [0b1001_0000, [0, 1, 2, 4, 5]],
          // 10) UNSUBSCRIBE (at least 5 bytes)
          [0b1010_0010, [0, 1, 2, 3, 4]],
          // 11) UNSUBACK (2 bytes)
          [0b1011_0000, [0, 1, 3, 4]],
          // 12) PINGREQ (0 bytes)
          [0b1100_0000, [1, 2, 3, 4, 5]],
          // 13) PINGRESP (0 bytes)
          [0b1101_0000, [1, 2, 3, 4, 5]],
          // 14) DISCONNECT (0 bytes)
          [0b1110_0000, [1, 2, 3, 4, 5]],
        ];

        invalidCases.forEach(([firstByte, invalidLengths]) => {
          invalidLengths.forEach((invalidLength) => {
            const packet = [firstByte, invalidLength];
            const reader = readerFrom(packet);
            const parser = new FixedHeaderParserV4();

            expect(() => parser.parse(reader)).toThrow(/Remaining Length/);
          });
        });
      });
    });

    describe("Chunked Inputs", () => {
      it("returns null when not enough data to parse Fixed Header", () => {
        [
          // PUBLISH packet with no Remaining Length byte
          [0b0011_0000],
          // PUBLISH packets with incomplete Remaining Length byte
          [0b0011_0000, 0x80],
          [0b0011_0000, 0x80, 0x80, 0x80],
        ].forEach((packet) => {
          const reader = readerFrom(packet);
          const parser = new FixedHeaderParserV4();

          const fixedHeader = parser.parse(reader);

          expect(fixedHeader).toBeNull();
        });
      });

      it("parses fixed header when data is in single chunk", () => {
        [
          {
            // DISCONNECT packet with remaining length 5
            packet: [0b0011_0000, 0x05],
            expected: {
              packetType: 0b0011,
              flags: 0b0000,
              remainingLength: 0x05,
            },
          },
          {
            // PUBREL packet with remaining length 2
            packet: [0b0110_0010, 0x02],
            expected: {
              packetType: 0b0110,
              flags: 0b0010,
              remainingLength: 0x02,
            },
          },
          {
            // PUBLISH packet with remaining length 128
            packet: [0b0011_0000, 0x80, 0x01],
            expected: {
              packetType: 0b0011,
              flags: 0b0000,
              remainingLength: 0x80,
            },
          },
        ].forEach(({ packet, expected }) => {
          testMultipleChunksParsing([packet], expected);
        });
      });

      it("parses fixed header when data is in two chunks", () => {
        [
          {
            // DISCONNECT packet with empty first chunk
            chunks: [[], [0b1110_0000, 0x00]],
            expected: {
              packetType: 0b1110,
              flags: 0b0000,
              remainingLength: 0x00,
            },
          },
          {
            // PUBLISH packet with remaining length 5
            chunks: [[0b0011_0000], [0x05]],
            expected: {
              packetType: 0b0011,
              flags: 0b0000,
              remainingLength: 0x05,
            },
          },
          {
            // PUBLISH packet with remaining length 128
            chunks: [[0b0011_0000, 0x80], [0x01]],
            expected: {
              packetType: 0b0011,
              flags: 0b0000,
              remainingLength: 0x80,
            },
          },
        ].forEach((testCase) => {
          testMultipleChunksParsing(testCase.chunks, testCase.expected);
        });
      });

      it("parses fixed header when data is in three chunks", () => {
        [
          {
            // PUBLISH packet with empty first chunk
            chunks: [[], [0b0011_0000], [0x03]],
            expected: {
              packetType: 0b0011,
              flags: 0b0000,
              remainingLength: 0x03,
            },
          },
          {
            // PUBLISH packet with remaining length 128 in three chunks
            chunks: [[0b0011_0000], [0x80], [0x01]],
            expected: {
              packetType: 0b0011,
              flags: 0b0000,
              remainingLength: 0x80,
            },
          },
          {
            // PUBLISH packet with remaining length 16384 in three chunks
            chunks: [[0b0011_0000, 0x80], [0x80], [0x01]],
            expected: {
              packetType: 0b0011,
              flags: 0b0000,
              remainingLength: 0x4000,
            },
          },
          {
            // PUBLISH packet with remaining length 16384 in three chunks (different split)
            chunks: [[0b0011_0000], [0x80, 0x80], [0x01]],
            expected: {
              packetType: 0b0011,
              flags: 0b0000,
              remainingLength: 0x4000,
            },
          },
          {
            // PUBLISH packet with remaining length 16384 in three chunks (different split 2)
            chunks: [[0b0011_0000], [0x80], [0x80, 0x01]],
            expected: {
              packetType: 0b0011,
              flags: 0b0000,
              remainingLength: 0x4000,
            },
          },
          {
            // SUBSCRIBE packet with remaining length 256 in three chunks
            chunks: [[0b1000_0010], [0x80], [0x02]],
            expected: {
              packetType: 0b1000,
              flags: 0b0010,
              remainingLength: 0x0100,
            },
          },
        ].forEach((testCase) => {
          testMultipleChunksParsing(testCase.chunks, testCase.expected);
        });
      });

      it("parses fixed header when data is in four chunks", () => {
        [
          {
            // PUBLISH packet with two empty chunks in the middle
            chunks: [[0b0011_0000], [], [], [0x0f]],
            expected: {
              packetType: 0b0011,
              flags: 0b0000,
              remainingLength: 0x0f,
            },
          },
          {
            // PUBLISH packet with remaining length 16384 in four chunks
            chunks: [[0b0011_0000], [0x80], [0x80], [0x01]],
            expected: {
              packetType: 0b0011,
              flags: 0b0000,
              remainingLength: 0x4000,
            },
          },
          {
            // PUBLISH packet with remaining length 16384 in four chunks (different split)
            chunks: [[0b0011_0000], [], [0x80, 0x80], [0x01]],
            expected: {
              packetType: 0b0011,
              flags: 0b0000,
              remainingLength: 0x4000,
            },
          },
          {
            // SUBSCRIBE packet with remaining length 256 in four chunks
            chunks: [[0b1000_0010], [], [], [0x0f]],
            expected: {
              packetType: 0b1000,
              flags: 0b0010,
              remainingLength: 0x0f,
            },
          },
        ].forEach((testCase) => {
          testMultipleChunksParsing(testCase.chunks, testCase.expected);
        });
      });

      it("parses fixed header when data is in five chunks", () => {
        [
          {
            // PUBLISH packet with three empty chunks in the middle
            chunks: [[0b0011_0000], [], [], [], [0x0f]],
            expected: {
              packetType: 0b0011,
              flags: 0b0000,
              remainingLength: 0x0f,
            },
          },
          {
            // SUBSCRIBE packet with remaining length 5000000 in five chunks
            chunks: [[0b1000_0010], [0xc0], [0x96], [0xb1], [0x02]],
            expected: {
              packetType: 0b1000,
              flags: 0b0010,
              remainingLength: 0x004c4b40,
            },
          },
          {
            // SUBSCRIBE packet with remaining length 5000000 in five chunks (different split)
            chunks: [[0b1000_0010], [0xc0, 0x96, 0xb1], [], [], [0x02]],
            expected: {
              packetType: 0b1000,
              flags: 0b0010,
              remainingLength: 0x004c4b40,
            },
          },
        ].forEach((testCase) => {
          testMultipleChunksParsing(testCase.chunks, testCase.expected);
        });
      });
    });
  });
});

//
// Helpers
//

// Create MQTTReaderV4 from number array
function readerFrom(array: number[]): MQTTReaderV4 {
  const uint8Array = new Uint8Array(array);
  const reader = new MQTTReaderV4(uint8Array);

  return reader;
}

// Test parsing Fixed Header from multiple chunks
function testMultipleChunksParsing(chunks: number[][], expected: FixedHeader) {
  if (chunks.length < 1) throw new Error("At least one chunk is required");

  const parser = new FixedHeaderParserV4();
  const lastIndex = chunks.length - 1;

  // test all chunks (without the last one)
  for (let i = 0; i < lastIndex; i++) {
    const chunk = chunks[i];
    const reader = readerFrom(chunk);
    const fixedHeader = parser.parse(reader);

    expect(fixedHeader).toBeNull(); // Not enough data yet
  }

  // test last chunk
  const lastChunk = chunks[lastIndex];
  const reader = readerFrom(lastChunk);
  const fixedHeader = parser.parse(reader);

  expect(fixedHeader).toStrictEqual(expected);
}
