import { describe, expect, it } from "vitest";
import { VariableByteIntegerDecoder } from "./VariableByteIntegerDecoder";
import { createDecodesDescription } from "./TestHelpers";

const cases: [number[], number][] = [
  [[0x00], 0x00],
  [[0x50], 0x50],
  [[0x7f], 0x7f],
  [[0x80, 0x01], 0x0080],
  [[0xff, 0x01], 0x00ff],
  [[0x80, 0x02], 0x0100],
  [[0xff, 0x7f], 0x3fff],
  [[0x80, 0x80, 0x01], 0x004000],
  [[0xff, 0xff, 0x7f], 0x1fffff],
  [[0x80, 0x80, 0x80, 0x01], 0x00200000],
  [[0xff, 0xff, 0xff, 0x7f], 0x0fffffff],
];

describe("Test `BytesDecoder.takeNextByte(bytes)`", () => {
  cases.forEach(([input, expected]) => {
    it(createDecodesDescription(input, expected), () => {
      const decoder = new VariableByteIntegerDecoder();

      expect(decoder.decodedBytesCount).toBe(0);

      for (let i = 0; i < input.length - 1; i++) {
        expect(decoder.takeNextByte(input[i])).toBe(false);
        expect(decoder.decodedBytesCount).toBe(i + 1);
      }

      expect(decoder.takeNextByte(input[input.length - 1])).toBe(expected);
      expect(decoder.decodedBytesCount).toBe(input.length);

      expect(() => decoder.takeNextByte(0xf0)).toThrowError(/decoded/);
    });
  });

  it("Should throw an Error when value > 0x0fffffff", () => {
    const decoder = new VariableByteIntegerDecoder();
    expect(decoder.takeNextByte(0xff)).toBe(false);
    expect(decoder.takeNextByte(0xff)).toBe(false);
    expect(decoder.takeNextByte(0xff)).toBe(false);
    expect(() => decoder.takeNextByte(0x80)).toThrowError(/Malformed/);
  });
});
