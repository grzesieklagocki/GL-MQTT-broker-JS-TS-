import { MqttWriterV4 } from "@src/mqtt/protocol/v4/encoding/MqttWriterV4";
import { describe, expect, it } from "vitest";

describe("MqttWriterV4", () => {
  describe("writeOneByteInteger()", () => {
    [
      { input: 0x00, expected: [0x00] },
      { input: 0x03, expected: [0x03] },
      { input: 0x51, expected: [0x51] },
      { input: 0x70, expected: [0x70] },
      { input: 0xff, expected: [0xff] },
    ].forEach(({ input, expected }) => {
      it(`writes ${input} as [${expected}]`, () => {
        const writer = new MqttWriterV4(expected.length);

        writer.writeOneByteInteger(input);

        expect(writer.toUint8Array()).toStrictEqual(Uint8Array.from(expected));
      });
    });
  });

  describe("writeTwoByteInteger()", () => {
    [
      { input: 0x0000, expected: [0x00, 0x00] },
      { input: 0x000b, expected: [0x00, 0x0b] },
      { input: 0x0100, expected: [0x01, 0x00] },
      { input: 0x0d0e, expected: [0x0d, 0x0e] },
      { input: 0xffff, expected: [0xff, 0xff] },
    ].forEach(({ input, expected }) => {
      it(`writes ${input} to [${expected}]`, () => {
        const writer = new MqttWriterV4(expected.length);

        writer.writeTwoByteInteger(input);

        expect(writer.toUint8Array()).toStrictEqual(Uint8Array.from(expected));
      });
    });
  });

  describe("writeVariableByteInteger()", () => {
    [
      { input: 0x00, expected: [0x00] },
      { input: 0x50, expected: [0x50] },
      { input: 0x7f, expected: [0x7f] },

      { input: 0x0080, expected: [0x80, 0x01] },
      { input: 0x00ff, expected: [0xff, 0x01] },
      { input: 0x0100, expected: [0x80, 0x02] },
      { input: 0x3fff, expected: [0xff, 0x7f] },

      { input: 0x004000, expected: [0x80, 0x80, 0x01] },
      { input: 0x1fffff, expected: [0xff, 0xff, 0x7f] },

      { input: 0x00200000, expected: [0x80, 0x80, 0x80, 0x01] },
      { input: 0x0fffffff, expected: [0xff, 0xff, 0xff, 0x7f] },
    ].forEach(({ input, expected }) => {
      it(`writes ${input} as [${expected}]`, () => {
        const writer = new MqttWriterV4(expected.length);

        writer.writeVariableByteInteger(input);

        expect(writer.toUint8Array()).toStrictEqual(Uint8Array.from(expected));
      });
    });
  });
});
