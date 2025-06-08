import { describe, expect, it } from "vitest";
import { VariableByteIntegerDecoder } from "./VariableByteIntegerDecoder";
import { createDescription } from "./TestHelpers";

const cases: [number[], number][] = [
  [[0x00], 0x00],
  [[0x50], 0x50],
  [[0x7f], 127],
  [[0x80, 0x01], 128],
  [[0xff, 0x01], 255],
  [[0x80, 0x02], 256],
  [[0xff, 0x7f], 16383],
  [[0x80, 0x80, 0x01], 16384],
  [[0xff, 0xff, 0x7f], 2097151],
  [[0x80, 0x80, 0x80, 0x01], 2097152],
  [[0xff, 0xff, 0xff, 0x7f], 268435455],
];

describe("Test `BytesDecoder.takeNextByte(bytes)`", () => {
  cases.forEach(([input, expected]) => {
    it(createDescription(input, expected), () => {
      const decoder = new VariableByteIntegerDecoder();

      for (let i = 0; i < input.length - 1; i++)
        expect(decoder.takeNextByte(input[i])).toBe(false);

      expect(decoder.takeNextByte(input[input.length - 1])).toBe(expected);
      expect(() => decoder.takeNextByte(0xf0)).toThrowError(/decoded/);
    });
  });

  it("Should throw an Error when value > 268435455", () => {
    const decoder = new VariableByteIntegerDecoder();
    expect(decoder.takeNextByte(0xff)).toBe(false);
    expect(decoder.takeNextByte(0xff)).toBe(false);
    expect(decoder.takeNextByte(0xff)).toBe(false);
    expect(() => decoder.takeNextByte(0x80)).toThrowError(/Malformed/);
  });
});
