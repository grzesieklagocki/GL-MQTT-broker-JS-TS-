import { describe, it, vi, expect } from "vitest";
import { MQTTReaderV5 } from "./MQTTReaderV5";
import { arrayToHexString } from "../../shared/testHelpers";

describe("", () => {
  [
    // length = 0: empty string
    { input: [0x00, 0x00], expected: "" },

    // ASCII
    { input: [0x00, 0x01, 0x41], expected: "A" }, // "A"
    { input: [0x00, 0x02, 0x48, 0x69], expected: "Hi" }, // "Hi"
    { input: [0x00, 0x05, 0x48, 0x65, 0x6c, 0x6c, 0x6f], expected: "Hello" }, // "Hello"

    // Multibyte UTF-8 (Polish)
    {
      input: [0x00, 0x07, 0xc5, 0x81, 0xc3, 0xb3, 0x64, 0xc5, 0xba], // "Łódź": C5 81 | C3 B3 | 64 | C5 BA  (len = 7)
      expected: "Łódź",
    },

    // "zażółć": 7A 61 | C5 BC | C3 B3 | C5 82 | C4 87  (len = 10)
    {
      input: [
        0x00, 0x0a, 0x7a, 0x61, 0xc5, 0xbc, 0xc3, 0xb3, 0xc5, 0x82, 0xc4, 0x87,
      ],
      expected: "zażółć",
    },
    {
      input: [0x00, 0x06, 0xe6, 0xb1, 0x89, 0xe5, 0xad, 0x97], // Chinese "汉字": E6 B1 89 | E5 AD 97  (len = 6)
      expected: "汉字",
    },
    { input: [0x00, 0x04, 0xf0, 0x9f, 0x99, 0x82], expected: "🙂" }, // Emoji 🙂: F0 9F 99 82  (len = 4)

    // Extra bytes after string: reader should only consume string length
    { input: [0x00, 0x03, 0x23, 0x45, 0x56, 0xaa, 0xbb], expected: "#EV" },
  ].forEach(({ input, expected }) => {
    it(`decodes ${arrayToHexString(input)} to "${expected}"`, () => {
      const array = new Uint8Array(input);
      const reader = new MQTTReaderV5(array);
      const stringConverterMock = vi.fn().mockReturnValue(expected);
      const stringLenth = input[1];

      expect(reader.readString(stringConverterMock)).toEqual(expected);
      expect(stringConverterMock).toHaveBeenCalledTimes(1);
      expect(stringConverterMock).toHaveBeenCalledWith(
        new Uint8Array(input.slice(2, 2 + stringLenth))
      );
      expect(reader.remaining).toBe(input.length - 2 - stringLenth);
    });
  });

  [
    { input: [], reason: "empty buffer" },
    { input: [0x00], reason: "missing second length byte (incomplete header)" },
    { input: [0x00, 0x01], reason: "length = 1, but no payload" },
    {
      input: [0x00, 0x03, 0x23, 0x45],
      reason: "length = 3, but only 2 bytes present",
    },
    {
      input: [0x00, 0x04, 0xff],
      reason: "length = 4, but only 1 byte present",
    },
  ].forEach(({ input, reason }) => {
    it(`throws when ${reason}: ${arrayToHexString(input)}`, () => {
      const reader = new MQTTReaderV5(new Uint8Array(input));
      const converter = vi.fn().mockReturnValue("<ignored>");

      expect(() => reader.readString(converter)).toThrow(/Malformed/);
    });
  });
});
