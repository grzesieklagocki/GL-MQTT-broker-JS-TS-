import { expect, it, vi } from "vitest";
import { MQTTReader } from "./MQTTReader";
import { arrayToHexString } from "../../../testHelpers";

[
  // key="", value=""
  { input: [0x00, 0x00, 0x00, 0x00], expected: { key: "", value: "" } },

  // key="A", value="B"
  {
    input: [0x00, 0x01, 0x41, 0x00, 0x01, 0x42],
    expected: { key: "A", value: "B" },
  },

  // key="Hi", value="There"
  {
    input: [0x00, 0x02, 0x48, 0x69, 0x00, 0x05, 0x54, 0x68, 0x65, 0x72, 0x65],
    expected: { key: "Hi", value: "There" },
  },

  // key="A", value="B", extra bytes after pair
  {
    input: [0x00, 0x01, 0x41, 0x00, 0x01, 0x42, 0xde, 0xad],
    expected: { key: "A", value: "B" },
  },

  // key empty, value "X"
  { input: [0x00, 0x00, 0x00, 0x01, 0x58], expected: { key: "", value: "X" } },

  // key empty, value "X", with extra bytes after the pair
  {
    input: [0x00, 0x00, 0x00, 0x01, 0x58, 0xff, 0xff],
    expected: { key: "", value: "X" },
  },

  // key "X", value empty
  { input: [0x00, 0x01, 0x58, 0x00, 0x00], expected: { key: "X", value: "" } },

  // key "X", value empty, with extra bytes after the pair
  {
    input: [0x00, 0x01, 0x58, 0x00, 0x00, 0xff, 0xff],
    expected: { key: "X", value: "" },
  },
].forEach(({ input, expected }) => {
  it(`decodes ${arrayToHexString(input)} to ["${expected.key}", "${
    expected.value
  }"]`, () => {
    const array = new Uint8Array(input);
    const reader = new MQTTReader(array);
    const stringConverterMock = vi
      .fn()
      .mockReturnValueOnce(expected.key)
      .mockReturnValueOnce(expected.value);

    expect(reader.readStringPair(stringConverterMock)).toEqual([
      expected.key,
      expected.value,
    ]);
    expect(reader.remaining).toBe(
      input.length - 4 - expected.key.length - expected.value.length
    );
  });
});
