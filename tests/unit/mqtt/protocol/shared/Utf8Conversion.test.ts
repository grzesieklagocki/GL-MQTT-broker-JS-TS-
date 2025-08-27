import { describe, expect, it } from "vitest";
import { Uint8ArrayToUtf8String } from "../../../../../src/mqtt/protocol/shared/Utf8Conversion";

describe("Uint8ArrayToUtf8 (valid case)", () => {
  [
    { input: new Uint8Array([97]), expected: "a" },
    { input: new Uint8Array([72, 101, 108, 108, 111]), expected: "Hello" },
    {
      input: new Uint8Array([
        71, 114, 122, 101, 103, 111, 114, 122, 32, 197, 129, 46,
      ]),
      expected: "Grzegorz Ł.",
    },
    { input: new Uint8Array([195, 169]), expected: "é" },
    { input: new Uint8Array([208, 175]), expected: "Я" },
    { input: new Uint8Array([206, 169]), expected: "Ω" },
    { input: new Uint8Array([224, 164, 168]), expected: "न" },
    { input: new Uint8Array([227, 129, 130]), expected: "あ" },
    { input: new Uint8Array([226, 130, 172]), expected: "€" },
    { input: new Uint8Array([226, 151, 143]), expected: "●" },
    { input: new Uint8Array([240, 159, 145, 141]), expected: "👍" },
    { input: new Uint8Array([240, 144, 141, 136]), expected: "𐍈" },
    { input: new Uint8Array([240, 159, 155, 184]), expected: "🛸" },
    { input: new Uint8Array([240, 159, 167, 165]), expected: "🧥" },
    { input: new Uint8Array([224, 186, 135]), expected: "ງ" },
    { input: new Uint8Array([237, 158, 156]), expected: "힜" },
    { input: new Uint8Array([225, 132, 137]), expected: "ᄉ" },
    { input: new Uint8Array([224, 171, 175]), expected: "૯" },
    { input: new Uint8Array([237, 158, 163]), expected: "힣" },
    { input: new Uint8Array([240, 160, 161, 162]), expected: "𠡢" },
  ].forEach(({ input, expected }) => {
    it(`decodes 0x${Buffer.from(input).toString(
      "hex"
    )} to "${expected}"`, () => {
      expect(Uint8ArrayToUtf8String(input)).toBe(expected);
    });
  });

  it("accepts valid code points (edge cases)", () => {
    [
      { input: new Uint8Array([0x20]), expected: "\u0020" },
      { input: new Uint8Array([0x7e]), expected: "\u007E" },
      { input: new Uint8Array([0xc2, 0xa0]), expected: "\u00A0" },
      { input: new Uint8Array([0xef, 0xb7, 0x8f]), expected: "\uFDCF" },
      { input: new Uint8Array([0xef, 0xb7, 0xb0]), expected: "\uFDF0" },
      { input: new Uint8Array([0xef, 0xbf, 0xbd]), expected: "\uFFFD" },
      {
        input: new Uint8Array([0xf0, 0x9f, 0xbf, 0xbc]),
        expected: "\u{1FFFC}",
      },
      {
        input: new Uint8Array([0xf0, 0xbf, 0xbf, 0xb5]),
        expected: "\u{3FFF5}",
      },
      {
        input: new Uint8Array([0xf4, 0x8f, 0xbf, 0xbd]),
        expected: "\u{10FFFD}",
      },
    ].forEach(({ input, expected }) => {
      expect(Uint8ArrayToUtf8String(input)).toBe(expected);
    });
  });
});

describe("Uint8ArrayToUtf8 (invalid encoding case)", () => {
  [
    {
      input: new Uint8Array([0xc3]),
      description: "incomplete UTF-8 byte (missing continuation)",
    },
    {
      input: new Uint8Array([0xe2]),
      description: "missing additional bytes for valid UTF-8 sequence",
    },
    {
      input: new Uint8Array([0xf0, 0x9f, 0x91]),
      description: "truncated emoji sequence (not full 4-byte codepoint)",
    },
    {
      input: new Uint8Array([0x80]),
      description: "orphaned continuation byte (no leading byte)",
    },
    {
      input: new Uint8Array([0xc2, 0xc2]),
      description: "double leading byte with no valid continuation",
    },
    {
      input: new Uint8Array([0xf4, 0x90, 0x80, 0x80]),
      description: "codepoint beyond valid Unicode range (above 0x10FFFF)",
    },
    {
      input: new Uint8Array([0xed, 0xaf, 0xb0]),
      description: "UTF-8 encoding of UTF-16 surrogate half (invalid in UTF-8)",
    },
    {
      input: new Uint8Array([0xf8, 0xa1, 0xa1, 0xa1, 0xa1]),
      description: "invalid 5-byte sequence (UTF-8 only allows up to 4 bytes)",
    },
    {
      input: new Uint8Array([0xfc, 0x80, 0x80, 0x80, 0x80, 0x80]),
      description: "invalid 6-byte sequence (not allowed in UTF-8)",
    },
    {
      input: new Uint8Array([0xc0, 0xaf]),
      description: "overlong encoding of '/' character (should be 0x2F)",
    },
    {
      input: new Uint8Array([0xe0, 0x80, 0x80]),
      description: "overlong encoding of NULL (should be 0x00, not 3-byte)",
    },
    {
      input: new Uint8Array([0xf0, 0x80, 0x80, 0x80]),
      description: "overlong encoding of U+0000 (4-byte instead of 1-byte)",
    },
    {
      input: new Uint8Array([0xf8, 0xff, 0x80, 0x80, 0x80]),
      description:
        "invalid initial byte for 5-byte sequence (not allowed in UTF-8)",
    },
    {
      input: new Uint8Array([0xe2, 0xe2]),
      description:
        "two leading bytes with no continuation (incomplete multibyte sequence)",
    },
  ].forEach(({ input, description }) => {
    it(`throws an Error when input is 0x${Buffer.from(input).toString(
      "hex"
    )}: ${description}`, () => {
      expect(() => Uint8ArrayToUtf8String(input)).toThrowError(/Malformed/);
    });
  });
});

/**
 * The character data in a UTF-8 Encoded String MUST be well-formed UTF-8
 * as defined by the Unicode specification [Unicode] and restated in RFC 3629 [RFC3629].
 * In particular, the character data MUST NOT include encodings of code points between U+D800 and U+DFFF
 *
 * [MQTT-1.5.4-1]
 * https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html
 */
describe("Uint8ArrayToUtf8 (Unicode surrogate case)", () => {
  [
    {
      input: new Uint8Array([0xed, 0xa0, 0x80]),
      description: "Unicode U+D800 code point (surrogate) alone",
    },
    {
      input: new Uint8Array([0xed, 0xbf, 0xbf]),
      description: "Unicode U+DFFF code point (surrogate) alone",
    },
    {
      input: new Uint8Array([0xed, 0xaf, 0xbf]),
      description: "Unicode U+DBFF code point (surrogate) alone",
    },
    {
      input: new Uint8Array([0xed, 0xaf, 0xbf, 97, 98]),
      description:
        "Unicode U+DBFF code point (surrogate) at the beginning of the string",
    },
    {
      input: new Uint8Array([97, 0xed, 0xaf, 0xbf, 98]),
      description:
        "Unicode U+DBFF code point (surrogate) in the middle of the string",
    },
    {
      input: new Uint8Array([97, 98, 0xed, 0xaf, 0xbf]),
      description:
        "Unicode U+DBFF code point (surrogate) at the end of the string",
    },
  ].forEach(({ input, description }) => {
    it(`throws an Error when input is 0x${Buffer.from(input).toString(
      "hex"
    )}: ${description}`, () => {
      expect(() => Uint8ArrayToUtf8String(input)).toThrowError(/Malformed/);
    });
  });
});

/**
 * A UTF-8 Encoded String MUST NOT include an encoding of the null character U+0000.
 *
 * [MQTT-1.5.4-2]
 * https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html
 */
describe("Uint8ArrayToUtf8 (Unicode null character case)", () => {
  [
    {
      input: new Uint8Array([0x00]),
      description: "Unicode U+0000 code point (NULL) alone",
    },
    {
      input: new Uint8Array([0x00, 97, 98]),
      description:
        "Unicode U+0000 code point (NULL) at the beginning of the string",
    },
    {
      input: new Uint8Array([97, 0x00, 98]),
      description:
        "Unicode U+0000 code point (NULL) in the middle of the string",
    },
    {
      input: new Uint8Array([97, 98, 0x00]),
      description: "Unicode U+0000 code point (NULL) at the end of the string",
    },
  ].forEach(({ input, description }) => {
    it(`throws an Error when input is 0x${Buffer.from(input).toString(
      "hex"
    )}: ${description}`, () => {
      expect(() => Uint8ArrayToUtf8String(input)).toThrowError(/Malformed/);
    });
  });
});

/* A UTF-8 encoded sequence 0xEF 0xBB 0xBF is always interpreted as U+FEFF ("ZERO WIDTH NO-BREAK SPACE")
 * wherever it appears in a string and MUST NOT be skipped over or stripped off by a packet receiver
 *
 * [MQTT-1.5.4-3].
 * https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html
 */
describe("Uint8ArrayToUtf8 (BOM case)", () => {
  [
    {
      input: new Uint8Array([0xef, 0xbb, 0xbf]),
      expected: "\uFEFF",
      description: "accepts BOM (U+FEFF) alone",
    },
    {
      input: new Uint8Array([0xef, 0xbb, 0xbf, 97, 98]),
      expected: "\uFEFFab",
      description: "accepts BOM (U+FEFF) at the beginning of the string",
    },
    {
      input: new Uint8Array([97, 0xef, 0xbb, 0xbf, 98]),
      expected: "a\uFEFFb",
      description: "accepts BOM (U+FEFF) in the middle of the string",
    },
    {
      input: new Uint8Array([97, 98, 0xef, 0xbb, 0xbf]),
      expected: "ab\uFEFF",
      description: "accepts BOM (U+FEFF) at the end of the string",
    },
  ].forEach(({ input, expected, description }) => {
    it(description, () => {
      expect(Uint8ArrayToUtf8String(input)).toBe(expected);
    });
  });
});

/*
 * The data SHOULD NOT include encodings of the Unicode [Unicode] code points listed below.
 * If a receiver (Server or Client) receives an MQTT Control Packet containing any of them it MAY treat it as a Malformed Packet.
 * These are the Disallowed Unicode code points.
 *
 * - U+0001..U+001F control characters
 * - U+007F..U+009F control characters
 * - (...)
 *
 * [MQTT 5.0, section 1.5.4]
 */
describe("Uint8ArrayToUtf8 (Unicode control character case)", () => {
  [
    {
      input: new Uint8Array([0x1c]),
      description: "Unicode U+001C code point (control) alone",
    },
    {
      input: new Uint8Array([0x1c, 97, 98]),
      description:
        "Unicode U+001C code point (control) at the beginning of the string",
    },
    {
      input: new Uint8Array([97, 0x1c, 98]),
      description:
        "Unicode U+001C code point (control) in the middle of the string",
    },
    {
      input: new Uint8Array([97, 98, 0x1c]),
      description:
        "Unicode U+001C code point (control) at the end of the string",
    },
  ].forEach(({ input, description }) => {
    it(`throws an Error when input is 0x${Buffer.from(input).toString(
      "hex"
    )}: ${description}`, () => {
      expect(() => Uint8ArrayToUtf8String(input)).toThrowError(/Malformed/);
    });
  });

  it("rejects all Unicode control characters", () => {
    const encoder = new TextEncoder();

    [
      // <U+0001-U+001F>
      0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x0008, 0x0009,
      0x000a, 0x000b, 0x000c, 0x000d, 0x000e, 0x000f, 0x0010, 0x0011, 0x0012,
      0x0013, 0x0014, 0x0015, 0x0016, 0x0017, 0x0018, 0x0019, 0x001a, 0x001b,
      0x001c, 0x001d, 0x001e, 0x001f,
      // <U+007F-U+0x009F>
      0x007f, 0x0080, 0x0081, 0x0082, 0x0083, 0x0084, 0x0085, 0x0086, 0x0087,
      0x0088, 0x0089, 0x008a, 0x008b, 0x008c, 0x008d, 0x008e, 0x008f, 0x0090,
      0x0091, 0x0092, 0x0093, 0x0094, 0x0095, 0x0096, 0x0097, 0x0098, 0x0099,
      0x009a, 0x009b, 0x009c, 0x009d, 0x009e, 0x009f,
    ].forEach((controlCharacter) => {
      const char = String.fromCodePoint(controlCharacter);
      const array = encoder.encode(char);

      expect(() => Uint8ArrayToUtf8String(array)).toThrowError(/Malformed/);
    });
  });
});

/*
 * The data SHOULD NOT include encodings of the Unicode [Unicode] code points listed below.
 * If a receiver (Server or Client) receives an MQTT Control Packet containing any of them it MAY treat it as a Malformed Packet.
 * These are the Disallowed Unicode code points.
 *
 * - (...)
 * - Code points defined in the Unicode specification [Unicode] to be non-characters (for example U+0FFFF)
 *
 * [MQTT 5.0, section 1.5.4]
 */
describe("Uint8ArrayToUtf8 (Unicode non-character case)", () => {
  [
    {
      input: new Uint8Array([0xfd, 0xef]),
      description: "Unicode U+FDEF code point (non-character) alone",
    },
    {
      input: new Uint8Array([0xfd, 0xef, 97, 98]),
      description:
        "Unicode U+FDEF code point (non-character) at the beginning of the string",
    },
    {
      input: new Uint8Array([97, 0xfd, 0xef, 98]),
      description:
        "Unicode U+FDEF code point (non-character) in the middle of the string",
    },
    {
      input: new Uint8Array([97, 98, 0xfd, 0xef]),
      description:
        "Unicode U+FDEF code point (non-character) at the end of the string",
    },
  ].forEach(({ input, description }) => {
    it(`throws an Error when input is 0x${Buffer.from(input).toString(
      "hex"
    )}: ${description}`, () => {
      expect(() => Uint8ArrayToUtf8String(input)).toThrowError(/Malformed/);
    });
  });

  it("rejects all Unicode non-characters", () => {
    const encoder = new TextEncoder();

    [
      // <U+FDD0-U+FDEF>
      0xfdd0, 0xfdd1, 0xfdd2, 0xfdd3, 0xfdd4, 0xfdd5, 0xfdd6, 0xfdd7, 0xfdd8,
      0xfdd9, 0xfdda, 0xfddb, 0xfddc, 0xfddd, 0xfdde, 0xfddf, 0xfde0, 0xfde1,
      0xfde2, 0xfde3, 0xfde4, 0xfde5, 0xfde6, 0xfde7, 0xfde8, 0xfde9, 0xfdea,
      0xfdeb, 0xfdec, 0xfded, 0xfdee, 0xfdef,
      // U+xxFFFE and U+xxFFFF
      0x00fffe, 0x00ffff, 0x01fffe, 0x01ffff, 0x02fffe, 0x02ffff, 0x03fffe,
      0x03ffff, 0x04fffe, 0x04ffff, 0x05fffe, 0x05ffff, 0x06fffe, 0x06ffff,
      0x07fffe, 0x07ffff, 0x08fffe, 0x08ffff, 0x09fffe, 0x09ffff, 0x0afffe,
      0x0affff, 0x0bfffe, 0x0bffff, 0x0cfffe, 0x0cffff, 0x0dfffe, 0x0dffff,
      0x0efffe, 0x0effff, 0x0ffffe, 0x0fffff, 0x10fffe, 0x10ffff,
    ].forEach((nonCharacter) => {
      const char = String.fromCodePoint(nonCharacter);
      const array = encoder.encode(char);

      expect(() => Uint8ArrayToUtf8String(array)).toThrowError(/Malformed/);
    });
  });
});
