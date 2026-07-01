import { MqttWriterV4 } from "@src/mqtt/protocol/v4/encoding/MqttWriterV4";
import { describe, expect, it } from "vitest";

describe("MqttWriterV4", () => {
  describe("writeBinaryData", () => {
    [
      { input: [], expected: [0x00, 0x00] }, // length = 0: empty data
      { input: [0xaa], expected: [0x00, 0x01, 0xaa] }, // length = 1: single byte
      { input: [0xde, 0xad], expected: [0x00, 0x02, 0xde, 0xad] }, // length = 2: two bytes
      { input: [0x23, 0x45, 0x56], expected: [0x00, 0x03, 0x23, 0x45, 0x56] }, // length = 3: three bytes
      {
        // length = 4: multi–byte sequence
        input: [0x12, 0x34, 0x56, 0x78],
        expected: [0x00, 0x04, 0x12, 0x34, 0x56, 0x78],
      },
      {
        // length = 260: multi–byte sequence
        input: Array.from({ length: 260 }, (_, i) => i),
        expected: [0x01, 0x04, ...Array.from({ length: 260 }, (_, i) => i)],
      },
    ].forEach(({ input, expected }) => {
      it(`writes [${input}] as [${expected}]`, () => {
        const writer = new MqttWriterV4(expected.length);
        const data = new Uint8Array(input);

        writer.writeBinaryData(data);

        const array = writer.toUint8Array();

        expect(array).toStrictEqual(Uint8Array.from(expected));
      });
    });
  });
});
