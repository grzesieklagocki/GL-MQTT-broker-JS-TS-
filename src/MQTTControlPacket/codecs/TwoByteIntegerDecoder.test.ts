import { describe, expect, it } from "vitest";
import { TwoByteIntegerDecoder } from "./TwoByteIntegerDecoder";

describe("Test `TwoByteIntegerDecoder.decode(bytes)`", () => {
  it("Should throw an error when length of bytes array is 0", () => {
    const decoder = new TwoByteIntegerDecoder();
    expect(() => decoder.decode([])).toThrowError(/2/);
  });
  it("Should throw an error when length of bytes array is 1", () => {
    const decoder = new TwoByteIntegerDecoder();
    expect(() => decoder.decode([0x11])).toThrowError(/2/);
  });
  it("Should throw an error when length of bytes array is 3", () => {
    const decoder = new TwoByteIntegerDecoder();
    expect(() => decoder.decode([0x11, 0x22, 0x33])).toThrowError(/2/);
  });
  it("Should return `0x0000` when bytes array is `[0x00, 0x00]`", () => {
    const decoder = new TwoByteIntegerDecoder();
    expect(decoder.decode([0x00, 0x00])).toBe(0x0000);
  });
  it("Should return `0x00FF` when bytes array is `[0x00, 0xFF]`", () => {
    const decoder = new TwoByteIntegerDecoder();
    expect(decoder.decode([0x00, 0xff])).toBe(0x00ff);
  });
  it("Should return `0xFF00` when bytes array is `[0xFF, 0x00]`", () => {
    const decoder = new TwoByteIntegerDecoder();
    expect(decoder.decode([0xff, 0x00])).toBe(0xff00);
  });
  it("Should return `0xFFFF` when bytes array is `[0xFF, 0xFF]`", () => {
    const decoder = new TwoByteIntegerDecoder();
    expect(decoder.decode([0xff, 0xff])).toBe(0xffff);
  });
  it("Should return `0x2345` when bytes array is `[0x23, 0x45]`", () => {
    const decoder = new TwoByteIntegerDecoder();
    expect(decoder.decode([0x23, 0x45])).toBe(0x2345);
  });
});

describe("Test `TwoByteIntegerDecoder.takeNextByte(byte)` with arguments: 0x00, 0x00, 0x00", () => {
  const decoder = new TwoByteIntegerDecoder();
  it("Should return false when first time called", () => {
    expect(decoder.takeNextByte(0x00)).toBe(false);
  });
  it("Should return '0x0000' when second time called", () => {
    expect(decoder.takeNextByte(0x00)).toBe(0x0000);
  });
  it("Should throw an error when third time called", () => {
    expect(() => decoder.takeNextByte(0x00)).toThrowError(/decoded/);
  });
});
describe("Test `TwoByteIntegerDecoder.takeNextByte(byte)` with arguments: 0x00, 0xFF, 0x12", () => {
  const decoder = new TwoByteIntegerDecoder();
  it("Should return false when first time called", () => {
    expect(decoder.takeNextByte(0x00)).toBe(false);
  });
  it("Should return '0x00FF' when second time called", () => {
    expect(decoder.takeNextByte(0xff)).toBe(0x00ff);
  });
  it("Should throw an error when third time called", () => {
    expect(() => decoder.takeNextByte(0x12)).toThrowError(/decoded/);
  });
});
describe("Test `TwoByteIntegerDecoder.takeNextByte(byte)` with arguments: 0xFF, 0x00, 0x23", () => {
  const decoder = new TwoByteIntegerDecoder();
  it("Should return false when first time called", () => {
    expect(decoder.takeNextByte(0xff)).toBe(false);
  });
  it("Should return '0xFF00' when second time called", () => {
    expect(decoder.takeNextByte(0x00)).toBe(0xff00);
  });
  it("Should throw an error when third time called", () => {
    expect(() => decoder.takeNextByte(0x23)).toThrowError(/decoded/);
  });
});
describe("Test `TwoByteIntegerDecoder.takeNextByte(byte)` with arguments: 0xFF, 0xFF, 0x35", () => {
  const decoder = new TwoByteIntegerDecoder();
  it("Should return false when first time called", () => {
    expect(decoder.takeNextByte(0xff)).toBe(false);
  });
  it("Should return '0xFFFF' when second time called", () => {
    expect(decoder.takeNextByte(0xff)).toBe(0xffff);
  });
  it("Should throw an error when third time called", () => {
    expect(() => decoder.takeNextByte(0x35)).toThrowError(/decoded/);
  });
});
describe("Test `TwoByteIntegerDecoder.takeNextByte(byte)` with arguments: 0x47, 0x90, 0x84", () => {
  const decoder = new TwoByteIntegerDecoder();
  it("Should return false when first time called", () => {
    expect(decoder.takeNextByte(0x47)).toBe(false);
  });
  it("Should return '0x4790' when second time called", () => {
    expect(decoder.takeNextByte(0x90)).toBe(0x4790);
  });
  it("Should throw an error when third time called", () => {
    expect(() => decoder.takeNextByte(0x84)).toThrowError(/decoded/);
  });
});
