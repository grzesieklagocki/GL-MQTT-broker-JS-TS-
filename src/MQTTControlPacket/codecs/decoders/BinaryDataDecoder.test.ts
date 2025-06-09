import { describe, expect, it } from "vitest";
import { BinaryDataDecoder } from "./BinaryDataDecoder";

describe("", () => {
  it("decodes 0 bytes", () => {
    const decoder = new BinaryDataDecoder<Uint8Array>((x) => x);

    expect(decoder.takeNextByte(0x00)).toBe(false);
    expect(decoder.takeNextByte(0x00)).toStrictEqual(new Uint8Array());
    expect(() => decoder.takeNextByte(0xf0)).toThrowError(/decoded/);
  });
  it("decodes 1 byte", () => {
    const decoder = new BinaryDataDecoder<Uint8Array>((x) => x);

    expect(decoder.takeNextByte(0x00)).toBe(false);
    expect(decoder.takeNextByte(0x01)).toBe(false);
    expect(decoder.takeNextByte(0x0c)).toStrictEqual(new Uint8Array([0x0c]));
    expect(() => decoder.takeNextByte(0xf0)).toThrowError(/decoded/);
  });
  it("decodes 2 bytes", () => {
    const decoder = new BinaryDataDecoder<Uint8Array>((x) => x);

    expect(decoder.takeNextByte(0x00)).toBe(false);
    expect(decoder.takeNextByte(0x02)).toBe(false);
    expect(decoder.takeNextByte(0x15)).toBe(false);
    expect(decoder.takeNextByte(0x0c)).toStrictEqual(
      new Uint8Array([0x15, 0x0c])
    );
    expect(() => decoder.takeNextByte(0xf0)).toThrowError(/decoded/);
  });
  it("decodes 0x0102 bytes", () => {
    const array = new Array(0x0102).fill(0x3e);
    const decoder = new BinaryDataDecoder<Uint8Array>((x) => x);

    expect(decoder.takeNextByte(0x01)).toBe(false);
    expect(decoder.takeNextByte(0x02)).toBe(false);
    expect(decoder.decodedBytesCount).toBe(0);

    for (let i = 0; i < array.length - 1; i++) {
      expect(decoder.takeNextByte(array[i])).toBe(false);
      expect(decoder.decodedBytesCount).toBe(i + 1);
    }

    expect(decoder.takeNextByte(array[array.length - 1])).toStrictEqual(
      new Uint8Array(array)
    );
    expect(decoder.decodedBytesCount).toBe(array.length);
    expect(() => decoder.takeNextByte(0xf0)).toThrowError(/decoded/);
    expect(decoder.decodedBytesCount).toBe(array.length);
  });
  it("decodes 0x0110 bytes", () => {
    const array = new Array(0x0110).fill(0x40);
    const decoder = new BinaryDataDecoder<Uint8Array>((x) => x);

    expect(decoder.takeNextByte(0x01)).toBe(false);
    expect(decoder.takeNextByte(0x10)).toBe(false);

    for (let i = 0; i < array.length - 1; i++)
      expect(decoder.takeNextByte(array[i])).toBe(false);

    array[5] = 0x41;

    expect(decoder.takeNextByte(array[array.length - 1])).not.toStrictEqual(
      new Uint8Array(array)
    );
    expect(() => decoder.takeNextByte(0xf0)).toThrowError(/decoded/);
  });
});
