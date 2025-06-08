import { describe, expect, it } from "vitest";
import { BytesDecoder } from "./BytesDecoder";
import { createDescription } from "./TestHelpers";

const cases: [number[], number][] = [
  [[0x00], 0x00],
  [[0x03], 0x03],
  [[0x51], 0x51],
  [[0x70], 0x70],
  [[0xff], 0xff],
  [[0x00, 0x00], 0x0000],
  [[0x00, 0x0b], 0x000b],
  [[0x01, 0x00], 0x0100],
  [[0x0d, 0x0e], 0x0d0e],
  [[0xff, 0xff], 0xffff],
  [[0x00, 0x00, 0x00, 0x00], 0x00000000],
  [[0x00, 0x00, 0x00, 0x02], 0x00000002],
  [[0x00, 0x00, 0x0e, 0x00], 0x00000e00],
  [[0x00, 0x48, 0x00, 0x00], 0x00480000],
  [[0x00, 0xff, 0xff, 0xff], 0x00ffffff],
  [[0x01, 0x00, 0x00, 0x00], 0x01000000],
  [[0x01, 0x01, 0x01, 0x01], 0x01010101],
  [[0x0f, 0xdd, 0xee, 0xaa], 0x0fddeeaa],
  [[0xaf, 0xdd, 0xee, 0xaa], 0xafddeeaa],
  [[0xda, 0xdd, 0xee, 0xaa], 0xdaddeeaa],
  [[0xff, 0xff, 0xff, 0xff], 0xffffffff],
];

describe("Test `BytesDecoder.takeNextByte(bytes)`", () => {
  cases.forEach(([input, expected]) => {
    it(createDescription(input, expected), () => {
      const decoder = new BytesDecoder(input.length);

      for (let i = 0; i < input.length - 1; i++) {
        expect(decoder.takeNextByte(input[i])).toBe(false);
        expect(decoder.isDecoded).toBe(false);
        expect(decoder.remainingBytes).toBe(input.length - i - 1);
      }

      expect(decoder.takeNextByte(input[input.length - 1])).toBe(expected);
      expect(decoder.isDecoded).toBe(true);
      expect(decoder.remainingBytes).toBe(0);
      
      expect(() => decoder.takeNextByte(0xf0)).toThrowError(/decoded/);
    });
  });
});

describe("Test `BytesDecoder` constructor", () => {
  it("throws error if bytesCount < 1", () => {
    expect(() => new BytesDecoder(0)).toThrowError(/range/);
  });
  [1, 2, 3, 4].forEach((x) => {
    it(`creates instance of BytesDecoder if bytesCount = ${x}`, () => {
      const decoder = new BytesDecoder(x);
      expect(decoder.remainingBytes).toBe(x);
      expect(decoder.isDecoded).toBe(false);
    });
  });
  it("throws error if bytesCount > 4", () => {
    expect(() => new BytesDecoder(5)).toThrowError(/range/);
  });
});
