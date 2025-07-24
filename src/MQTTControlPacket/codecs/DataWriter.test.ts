import { describe, expect, it } from "vitest";
import { DataWriter } from "./DataWriter";

describe("DataWriter.constructor", () => {
  it("creates instance of DataWriter when capacity is 1000 ", () => {
    const writer = new DataWriter(1000);
    expect(writer.capacity).toBe(1000);
  });
  it("throws an Error when capacity is 0 ", () => {
    expect(() => {
      new DataWriter(0);
    }).toThrowError(/1/);
  });
  it("throws an Error when capacity is -92 ", () => {
    expect(() => {
      new DataWriter(-92);
    }).toThrowError(/1/);
  });
});

describe("DataWriter.write(number)", () => {
  it("writes single byte", () => {
    const writer = new DataWriter(1);

    writer.write(42);

    expect(writer.length).toBe(1);
  });
  it("writes tree bytes in sequence", () => {
    const writer = new DataWriter(3);

    writer.write(0);
    writer.write(13);
    writer.write(254);

    expect(writer.length).toBe(3);
  });
  it("throws an Error when buffer is full", () => {
    const writer = new DataWriter(1);

    writer.write(23);

    expect(() => writer.write(22)).toThrowError(/overflow/);
  });
  it("throws an Error when write(number) is called on finalized writer", () => {
    const writer = new DataWriter(1);

    writer.write(120);
    writer.toArrayBuffer();

    expect(() => writer.write(218)).toThrowError(/finalized/);
  });
});

describe("DataWriter.write(Uint8Array)", () => {
  it("writes array of 2 bytes when capacity is 4", () => {
    const writer = new DataWriter(4);

    writer.write(Uint8Array.from([12, 14]));

    expect(writer.length).toBe(2);
    expect(writer.remaining).toBe(2);
  });
  it("writes array of 3 bytes when capacity is 3", () => {
    const writer = new DataWriter(3);

    writer.write(Uint8Array.from([12, 14, 99]));

    expect(writer.length).toBe(3);
    expect(writer.remaining).toBe(0);
  });
  it("throws an Error when writing 3 bytes if capacity is 2", () => {
    const writer = new DataWriter(2);

    expect(() => writer.write(Uint8Array.from([12, 14, 99]))).toThrowError(
      /overflow/
    );
  });
  it("throws an Error when write(Uint8Array) is called on finalized writer", () => {
    const writer = new DataWriter(1);

    writer.write(120);
    writer.toArrayBuffer();

    expect(() => writer.write(new Uint8Array([1]))).toThrowError(/finalized/);
  });
});

describe("DataWriter.canWrite(number?)", () => {
  it("returns true when call with no arguments and remaining is 1", () => {
    const writer = new DataWriter(1);

    expect(writer.canWrite()).toBe(true);
    expect(writer.remaining).toBe(1);
  });
  it("returns true when argument is 2 and remaining is 3", () => {
    const writer = new DataWriter(3);

    expect(writer.canWrite(2)).toBe(true);
    expect(writer.remaining).toBe(3);
  });
  it("returns true when argument is 3 and remaining is 3", () => {
    const writer = new DataWriter(3);

    expect(writer.canWrite(3)).toBe(true);
    expect(writer.remaining).toBe(3);
  });
  it("returns false when argument is 10 and remaining is 3", () => {
    const writer = new DataWriter(3);

    expect(writer.canWrite(10)).toBe(false);
  });
  it("throws an Error when argument is 0 or -700", () => {
    const writer = new DataWriter(1);

    expect(() => writer.canWrite(0)).toThrowError(/1/);
    expect(() => writer.canWrite(-700)).toThrowError(/1/);
  });
  it("throws an Error when write(Uint8Array) is called on finalized writer", () => {
    const writer = new DataWriter(1);

    writer.write(120);
    writer.toArrayBuffer();

    expect(() => writer.write(new Uint8Array([1]))).toThrowError(/finalized/);
  });
});

describe("DataWriter.toArrayBuffer()", () => {
  it("returns ArrayBuffer with 1 element [0] when capacity is 1 and no bytes has been written", () => {
    const writer = new DataWriter(1);

    expect(writer.toArrayBuffer()).toStrictEqual(Uint8Array.from([0]).buffer);
  });
  it("returns ArrayBuffer with 1 element [160] when capacity is 1 and 1 byte has been written", () => {
    const writer = new DataWriter(1);
    const array = Uint8Array.from([160]);

    writer.write(array);

    expect(writer.toArrayBuffer()).toStrictEqual(array.buffer);
  });
  it("returns ArrayBuffer with 2 elements [160, 0] when capacity is 2 and 1 byte has been written", () => {
    const writer = new DataWriter(2);
    const array = Uint8Array.from([160]);

    writer.write(array);

    expect(writer.toArrayBuffer()).toStrictEqual(
      Uint8Array.from([160, 0]).buffer
    );
  });
});
