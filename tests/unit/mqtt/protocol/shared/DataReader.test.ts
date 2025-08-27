import { describe, it, expect } from "vitest";
import { DataReader } from "../../../../../src/mqtt/protocol/shared/DataReader";

describe("DataReader.constructor", () => {
  it("creates instance of DataReader from from Uint8Array([0x12, 0x23])", () => {
    const array = new Uint8Array([0x12, 0x23]);
    const reader = new DataReader(array);

    expect(reader.capacity).toBe(2);
  });
  it("creates instance of DataReader from from empty Uint8Array", () => {
    const array = new Uint8Array();
    const reader = new DataReader(array);

    expect(reader.capacity).toBe(0);
  });
});

describe("DataReader.canRead", () => {
  it("throws an Error when argument is -273", () => {
    const array = new Uint8Array();
    const reader = new DataReader(array);

    expect(() => reader.canRead(-273)).toThrowError(/count/);
  });
  it("throws an Error when argument is 0", () => {
    const array = new Uint8Array();
    const reader = new DataReader(array);

    expect(() => reader.canRead(0)).toThrowError(/count/);
  });
  it("returns false when argument is 1 and capacity is 0", () => {
    const array = new Uint8Array();
    const reader = new DataReader(array);

    expect(reader.canRead(1)).toBe(false);
    expect(reader.capacity).toBe(0);
  });
  it("returns true when argument is 1 and capacity is 1", () => {
    const array = new Uint8Array([0xfd]);
    const reader = new DataReader(array);

    expect(reader.canRead(1)).toBe(true);
    expect(reader.capacity).toBe(1);
  });
  it("returns true when argument is 1 and capacity is 2", () => {
    const array = new Uint8Array([0x01, 0x02]);
    const reader = new DataReader(array);

    expect(reader.canRead(1)).toBe(true);
    expect(reader.capacity).toBe(2);
  });
  it("returns false when argument is 2 and capacity is 1", () => {
    const array = new Uint8Array([0x11]);
    const reader = new DataReader(array);

    expect(reader.canRead(2)).toBe(false);
    expect(reader.capacity).toBe(1);
  });
});

describe("DataReader.read", () => {
  it("throws when reading from an empty buffer", () => {
    const array = new Uint8Array([]);
    const reader = new DataReader(array);

    expect(() => reader.read(1)).toThrowError(/0/);
  });
  it("returns Uint8Array with single element when argument is 1", () => {
    const array = new Uint8Array([344]);
    const reader = new DataReader(array);

    expect(reader.read(1)).toStrictEqual(new Uint8Array([344]));
  });

  it("returns the first element when reading one byte from a multi-element array", () => {
    const array = new Uint8Array([10, 20, 30]);
    const reader = new DataReader(array);

    expect(reader.read(1)).toStrictEqual(new Uint8Array([10]));
  });

  it("advances internal offset between reads", () => {
    const array = new Uint8Array([10, 20, 30]);
    const reader = new DataReader(array);

    expect(reader.read(1)).toStrictEqual(new Uint8Array([10]));
    expect(reader.read(2)).toStrictEqual(new Uint8Array([20, 30]));
  });

  it("throws when there is not enough available bytes", () => {
    const array = new Uint8Array([10, 20, 30]);
    const reader = new DataReader(array);

    expect(reader.read(2)).toStrictEqual(new Uint8Array([10, 20]));
    expect(() => reader.read(2)).toThrowError(/1/);
  });

  it("throws when there is not enough available bytes (at start)", () => {
    const array = new Uint8Array([10, 20, 30]);
    const reader = new DataReader(array);

    expect(() => reader.read(4)).toThrowError(/3/);
  });

  it("throws when there is no available bytes", () => {
    const array = new Uint8Array([10, 20]);
    const reader = new DataReader(array);

    expect(reader.read(2)).toStrictEqual(new Uint8Array([10, 20]));
    expect(() => reader.read(1)).toThrowError(/0/);
  });
});

describe("DataReader.capacity and DataReader.remaining", () => {
  it("capacity is 0 for an empty buffer", () => {
    const array = new Uint8Array([]);
    const reader = new DataReader(array);

    expect(reader.capacity).toBe(0);
  });

  it("remaining is 0 for an empty buffer", () => {
    const array = new Uint8Array([]);
    const reader = new DataReader(array);

    expect(reader.remaining).toBe(0);
  });

  it("capacity equals the initial length of the buffer", () => {
    const array = new Uint8Array([10, 20, 30]);
    const reader = new DataReader(array);

    expect(reader.capacity).toBe(3);
  });

  it("remaining equals capacity before any read", () => {
    const array = new Uint8Array([10, 20, 30]);
    const reader = new DataReader(array);

    expect(reader.remaining).toBe(3);
  });

  it("remaining decreases after reading bytes", () => {
    const array = new Uint8Array([10, 20, 30]);
    const reader = new DataReader(array);

    reader.read(1);
    expect(reader.remaining).toBe(2);

    reader.read(2);
    expect(reader.remaining).toBe(0);
  });

  it("capacity is always constant", () => {
    const array = new Uint8Array([10, 20, 30]);
    const reader = new DataReader(array);

    expect(reader.capacity).toBe(3);
    reader.read(1);
    expect(reader.capacity).toBe(3);
    reader.read(2);
    expect(reader.capacity).toBe(3);
  });
});
