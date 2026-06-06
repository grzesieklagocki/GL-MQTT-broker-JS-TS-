import { describe, it, expect } from "vitest";
import { parseFixedHeaderFlags } from "@src/mqtt/protocol/shared/FixedHeaderFlagsParser";

describe("parseFixedHeaderFlags", () => {
  describe("Valid flag values (0-15)", () => {
    [
      // flags=0: binary 0000 -> retain=0, qos=0, dup=0
      { flags: 0b0000, retain: false, qos: 0, dup: false },
      // flags=1: binary 0001 -> retain=1, qos=0, dup=0
      { flags: 0b0001, retain: true, qos: 0, dup: false },
      // flags=2: binary 0010 -> retain=0, qos=1, dup=0
      { flags: 0b0010, retain: false, qos: 1, dup: false },
      // flags=3: binary 0011 -> retain=1, qos=1, dup=0
      { flags: 0b0011, retain: true, qos: 1, dup: false },
      // flags=4: binary 0100 -> retain=0, qos=2, dup=0
      { flags: 0b0100, retain: false, qos: 2, dup: false },
      // flags=5: binary 0101 -> retain=1, qos=2, dup=0
      { flags: 0b0101, retain: true, qos: 2, dup: false },
      // flags=6: binary 0110 -> retain=0, qos=3, dup=0
      { flags: 0b0110, retain: false, qos: 3, dup: false },
      // flags=7: binary 0111 -> retain=1, qos=3, dup=0
      { flags: 0b0111, retain: true, qos: 3, dup: false },
      // flags=8: binary 1000 -> retain=0, qos=0, dup=1
      { flags: 0b1000, retain: false, qos: 0, dup: true },
      // flags=9: binary 1001 -> retain=1, qos=0, dup=1
      { flags: 0b1001, retain: true, qos: 0, dup: true },
      // flags=10: binary 1010 -> retain=0, qos=1, dup=1
      { flags: 0b1010, retain: false, qos: 1, dup: true },
      // flags=11: binary 1011 -> retain=1, qos=1, dup=1
      { flags: 0b1011, retain: true, qos: 1, dup: true },
      // flags=12: binary 1100 -> retain=0, qos=2, dup=1
      { flags: 0b1100, retain: false, qos: 2, dup: true },
      // flags=13: binary 1101 -> retain=1, qos=2, dup=1
      { flags: 0b1101, retain: true, qos: 2, dup: true },
      // flags=14: binary 1110 -> retain=0, qos=3, dup=1
      { flags: 0b1110, retain: false, qos: 3, dup: true },
      // flags=15: binary 1111 -> retain=1, qos=3, dup=1
      { flags: 0b1111, retain: true, qos: 3, dup: true },
    ].forEach(({ flags, retain, qos, dup }) => {
      it(`parses flags=${flags} (binary ${flags.toString(2).padStart(4, "0")}) as retain=${retain}, qos=${qos}, dup=${dup}`, () => {
        const result = parseFixedHeaderFlags(flags);

        expect(result.retain).toBe(retain);
        expect(result.qos).toBe(qos);
        expect(result.dup).toBe(dup);
      });
    });
  });

  describe("Invalid flag values", () => {
    [-1, -128, 16, 17, 100, 255, 256, 1000].forEach((flags) => {
      it(`throws error for invalid flags value ${flags}`, () => {
        expect(() => parseFixedHeaderFlags(flags)).toThrow(/Invalid/);
      });
    });
  });

  describe("Edge cases", () => {
    it("handles minimum valid value (0)", () => {
      const result = parseFixedHeaderFlags(0);

      expect(result).toEqual({ retain: false, qos: 0, dup: false });
    });

    it("handles maximum valid value (15)", () => {
      const result = parseFixedHeaderFlags(15);

      expect(result).toEqual({ retain: true, qos: 3, dup: true });
    });
  });

  describe("Type structure", () => {
    it("returns correct type structure", () => {
      const result = parseFixedHeaderFlags(0);

      expect(result).toHaveProperty("retain");
      expect(result).toHaveProperty("qos");
      expect(result).toHaveProperty("dup");

      expect(typeof result.retain).toBe("boolean");
      expect(typeof result.qos).toBe("number");
      expect(typeof result.dup).toBe("boolean");
    });
  });
});
