import { PacketIdentifierManager } from "@src/mqtt/client/shared/PacketIdentifierManager";
import { describe, expect, it } from "vitest";

describe("PacketIdentifierManager", () => {
  it("allocates identifiers from 1", () => {
    const manager = new PacketIdentifierManager();

    expect(manager.allocateIdentifier()).toBe(1);
    expect(manager.allocateIdentifier()).toBe(2);
    expect(manager.allocateIdentifier()).toBe(3);
  });

  it("allocates only valid MQTT packet identifiers", () => {
    const manager = new PacketIdentifierManager();

    for (let i = 0; i < 65_535; i++) {
      const id = manager.allocateIdentifier();

      if (id <= 0 || id > 65_535) {
        throw new Error(`Returned invalid identifier: ${id}`);
      }
    }
  });

  it("does not allocate duplicates while identifiers are in use", () => {
    const manager = new PacketIdentifierManager();
    const allocated = new Set<number>();

    for (let i = 0; i < 65_535; i++) {
      const id = manager.allocateIdentifier();

      if (allocated.has(id)) {
        throw new Error(`Duplicate identifier allocated: ${id}`);
      }

      allocated.add(id);
    }

    expect(allocated.size).toBe(65_535);
  });

  it("allocates identifiers up to 65535", () => {
    const manager = new PacketIdentifierManager();

    let lastId = 0;

    for (let i = 0; i < 65_535; i++) {
      lastId = manager.allocateIdentifier();
    }

    expect(lastId).toBe(65_535);
  });

  it("throws when all identifiers are allocated", () => {
    const manager = new PacketIdentifierManager();

    for (let i = 0; i < 65_535; i++) {
      manager.allocateIdentifier();
    }

    expect(() => manager.allocateIdentifier()).toThrowError(
      "No more packet identifiers available."
    );
  });

  it("reuses a released identifier", () => {
    const manager = new PacketIdentifierManager();

    const first = manager.allocateIdentifier();
    const second = manager.allocateIdentifier();
    const third = manager.allocateIdentifier();

    expect([first, second, third]).toEqual([1, 2, 3]);

    manager.releaseIdentifier(second);

    expect(manager.allocateIdentifier()).toBe(second);
  });

  it("reuses multiple released identifiers without requiring order", () => {
    const manager = new PacketIdentifierManager();

    const ids = [
      manager.allocateIdentifier(),
      manager.allocateIdentifier(),
      manager.allocateIdentifier(),
      manager.allocateIdentifier(),
      manager.allocateIdentifier(),
    ];

    expect(ids).toEqual([1, 2, 3, 4, 5]);

    manager.releaseIdentifier(2);
    manager.releaseIdentifier(4);

    const reusedIds = [
      manager.allocateIdentifier(),
      manager.allocateIdentifier(),
    ];

    expect(reusedIds).toHaveLength(2);
    expect(reusedIds).toEqual(expect.arrayContaining([2, 4]));
  });

  it("throws when releasing an unallocated identifier", () => {
    const manager = new PacketIdentifierManager();

    expect(() => manager.releaseIdentifier(10)).toThrowError(
      "Cannot release packet identifier 10, it was not allocated."
    );
  });

  it("throws when releasing the same identifier twice", () => {
    const manager = new PacketIdentifierManager();

    const id = manager.allocateIdentifier();

    manager.releaseIdentifier(id);

    expect(() => manager.releaseIdentifier(id)).toThrowError(
      `Cannot release packet identifier ${id}, it was not allocated.`
    );
  });

  it("does not change state after a failed release", () => {
    const manager = new PacketIdentifierManager();

    expect(manager.allocateIdentifier()).toBe(1);
    expect(manager.allocateIdentifier()).toBe(2);

    expect(() => manager.releaseIdentifier(100)).toThrowError(
      "Cannot release packet identifier 100, it was not allocated."
    );

    expect(manager.allocateIdentifier()).toBe(3);

    manager.releaseIdentifier(1);

    expect(manager.allocateIdentifier()).toBe(1);
  });

  it("allocates again after exhaustion when an identifier is released", () => {
    const manager = new PacketIdentifierManager();

    for (let i = 0; i < 65_535; i++) {
      manager.allocateIdentifier();
    }

    manager.releaseIdentifier(12_345);

    expect(manager.allocateIdentifier()).toBe(12_345);

    expect(() => manager.allocateIdentifier()).toThrowError(
      "No more packet identifiers available."
    );
  });
});
