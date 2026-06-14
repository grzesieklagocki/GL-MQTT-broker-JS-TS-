import { beforeEach, describe, expect, it } from "vitest";
import { BinaryBuffer } from "@mqtt/protocol/shared/BinaryBuffer";

describe("BinaryBuffer", () => {
  let buffer: BinaryBuffer;

  beforeEach(() => {
    buffer = new BinaryBuffer();
  });

  it("should be empty after creation", () => {
    expect(buffer.remaining).toBe(0);
  });

  it("should increase remaining after write", () => {
    buffer.write(new Uint8Array([0x01, 0x02, 0x03]));

    expect(buffer.remaining).toBe(3);
  });

  it("should read written bytes in FIFO order", () => {
    buffer.write(new Uint8Array([0x01, 0x02, 0x03]));

    const result = buffer.read(3);

    expect([...result]).toEqual([0x01, 0x02, 0x03]);
    expect(buffer.remaining).toBe(0);
  });

  it("should support partial read", () => {
    buffer.write(new Uint8Array([0x01, 0x02, 0x03, 0x04]));

    const result = buffer.read(2);

    expect([...result]).toEqual([0x01, 0x02]);
    expect(buffer.remaining).toBe(2);
  });

  it("should continue reading from previous position after partial read", () => {
    buffer.write(new Uint8Array([0x01, 0x02, 0x03, 0x04]));

    buffer.read(2);
    const result = buffer.read(2);

    expect([...result]).toEqual([0x03, 0x04]);
    expect(buffer.remaining).toBe(0);
  });

  it("should preserve order across multiple writes", () => {
    buffer.write(new Uint8Array([0x01, 0x02]));
    buffer.write(new Uint8Array([0x03]));
    buffer.write(new Uint8Array([0x04, 0x05]));

    const result = buffer.read(5);

    expect([...result]).toEqual([0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(buffer.remaining).toBe(0);
  });

  it("should read bytes across multiple writes", () => {
    buffer.write(new Uint8Array([0x01, 0x02]));
    buffer.write(new Uint8Array([0x03, 0x04]));

    const result = buffer.read(3);

    expect([...result]).toEqual([0x01, 0x02, 0x03]);
    expect(buffer.remaining).toBe(1);
  });

  it("should support writing after partial read", () => {
    buffer.write(new Uint8Array([0x01, 0x02, 0x03]));

    const first = buffer.read(2);
    expect([...first]).toEqual([0x01, 0x02]);
    expect(buffer.remaining).toBe(1);

    buffer.write(new Uint8Array([0x04, 0x05]));

    const second = buffer.read(3);

    expect([...second]).toEqual([0x03, 0x04, 0x05]);
    expect(buffer.remaining).toBe(0);
  });

  it("should read one byte as integer", () => {
    buffer.write(new Uint8Array([0xab, 0xcd]));

    const result = buffer.readOneByteInteger();

    expect(result).toBe(0xab);
    expect(buffer.remaining).toBe(1);
  });

  it("should read bytes using readOneByteInteger", () => {
    buffer.write(new Uint8Array([0x10, 0x20, 0x30]));

    expect(buffer.readOneByteInteger()).toBe(0x10);
    expect(buffer.readOneByteInteger()).toBe(0x20);
    expect(buffer.readOneByteInteger()).toBe(0x30);
    expect(buffer.remaining).toBe(0);
  });

  it("should allow writing an empty array", () => {
    buffer.write(new Uint8Array([]));

    expect(buffer.remaining).toBe(0);
  });

  it("should not allow reading zero bytes", () => {
    buffer.write(new Uint8Array([0x01, 0x02]));

    expect(() => buffer.read(0)).toThrow(/greater/);
  });

  it("should throw when trying to read more bytes than available", () => {
    buffer.write(new Uint8Array([0x01, 0x02]));

    expect(() => buffer.read(3)).toThrow();
    expect(buffer.remaining).toBe(2);
  });

  it("should throw when trying to read one byte from empty buffer", () => {
    expect(() => buffer.readOneByteInteger()).toThrow();
    expect(buffer.remaining).toBe(0);
  });

  it("should throw when read count is negative", () => {
    buffer.write(new Uint8Array([0x01]));

    expect(() => buffer.read(-1)).toThrow();
    expect(buffer.remaining).toBe(1);
  });
});
