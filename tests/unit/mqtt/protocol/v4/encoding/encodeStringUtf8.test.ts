import { Uint8ArrayToUtf8String } from "@mqtt/protocol/shared/Utf8Conversion";
import { encodeStringUtf8 } from "@src/mqtt/protocol/v4/encoding/encodeStringUtf8";
import { describe, expect, it } from "vitest";

describe("encodeStringUtf8()", () => {
  [
    // length = 0: empty string
    { input: "", expected: [] },

    // ASCII
    { input: "A", expected: [0x41] }, // "A"
    { input: "Hi", expected: [0x48, 0x69] }, // "Hi"
    { input: "Hello", expected: [0x48, 0x65, 0x6c, 0x6c, 0x6f] }, // "Hello"

    // Multibyte UTF-8 (Polish)
    {
      input: "Łódź",
      expected: [0xc5, 0x81, 0xc3, 0xb3, 0x64, 0xc5, 0xba], // "Łódź": C5 81 | C3 B3 | 64 | C5 BA  (len = 7)
    },

    // "zażółć": 7A 61 | C5 BC | C3 B3 | C5 82 | C4 87  (len = 10)
    {
      input: "zażółć",
      expected: [0x7a, 0x61, 0xc5, 0xbc, 0xc3, 0xb3, 0xc5, 0x82, 0xc4, 0x87],
    },

    // Chinese "汉字": E6 B1 89 | E5 AD 97  (len = 6)
    {
      input: "汉字",
      expected: [0xe6, 0xb1, 0x89, 0xe5, 0xad, 0x97],
    },

    // Emoji 🙂: F0 9F 99 82  (len = 4)
    { input: "🙂", expected: [0xf0, 0x9f, 0x99, 0x82] },
    { input: "#EV", expected: [0x23, 0x45, 0x56] },
  ].forEach(({ input, expected }) => {
    it(`encodes "${input}" to [${expected}]`, () => {
      const encoded = encodeStringUtf8(input);

      expect(encoded).toStrictEqual(Uint8Array.from(expected));

      // check that the string can be decoded back to the original input
      expect(Uint8ArrayToUtf8String(encoded)).toBe(input);
    });
  });
});
