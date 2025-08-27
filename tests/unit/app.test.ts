import { describe, it, expect } from "vitest";
import { testFunction } from "../../src/app";

describe("Test function", () => {
  it("should return 'test' string", () => {
    expect(testFunction()).toBe("test");
  });
});
