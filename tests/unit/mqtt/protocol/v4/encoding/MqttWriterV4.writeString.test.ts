import { Uint8ArrayToUtf8String } from "@mqtt/protocol/shared/Utf8Conversion";
import { MqttWriterV4 } from "@mqtt/protocol/v4/encoding/MqttWriterV4";
import { describe, expect, it } from "vitest";

describe("MqttWriterV4", () => {
  describe("writeString()", () => {
    [
      // length = 0: empty string
      { input: "", expected: [0x00, 0x00] },

      // ASCII
      { input: "A", expected: [0x00, 0x01, 0x41] }, // "A"
      { input: "Hi", expected: [0x00, 0x02, 0x48, 0x69] }, // "Hi"
      { input: "Hello", expected: [0x00, 0x05, 0x48, 0x65, 0x6c, 0x6c, 0x6f] }, // "Hello"

      // Multibyte UTF-8 (Polish)
      {
        input: "Łódź",
        expected: [0x00, 0x07, 0xc5, 0x81, 0xc3, 0xb3, 0x64, 0xc5, 0xba], // "Łódź": C5 81 | C3 B3 | 64 | C5 BA  (len = 7)
      },

      // "zażółć": 7A 61 | C5 BC | C3 B3 | C5 82 | C4 87  (len = 10)
      {
        input: "zażółć",
        expected: [
          0x00, 0x0a, 0x7a, 0x61, 0xc5, 0xbc, 0xc3, 0xb3, 0xc5, 0x82, 0xc4,
          0x87,
        ],
      },

      // Chinese "汉字": E6 B1 89 | E5 AD 97  (len = 6)
      {
        input: "汉字",
        expected: [0x00, 0x06, 0xe6, 0xb1, 0x89, 0xe5, 0xad, 0x97],
      },

      // Emoji 🙂: F0 9F 99 82  (len = 4)
      { input: "🙂", expected: [0x00, 0x04, 0xf0, 0x9f, 0x99, 0x82] },
      { input: "#EV", expected: [0x00, 0x03, 0x23, 0x45, 0x56] },
    ].forEach(({ input, expected }) => {
      it(`writes "${input}" as [${expected}]`, () => {
        const writer = new MqttWriterV4(expected.length);

        writer.writeString(input);

        const array = writer.toUint8Array();

        expect(array).toStrictEqual(Uint8Array.from(expected));

        // check that the string can be decoded back to the original input
        expect(Uint8ArrayToUtf8String(array.slice(2))).toBe(input);
      });
    });
  });
});
