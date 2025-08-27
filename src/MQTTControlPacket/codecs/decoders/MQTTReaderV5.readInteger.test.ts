import { describe, expect, it, vi } from "vitest";
import { IntegerTypeV5, MQTTReaderV5 } from "./MQTTReaderV5";
import { arrayToHexString, uint8ToHexString } from "../../../testHelpers";

describe("MQTTReader.readInteger(IntegerType.oneByte)", () => {
  [
    { input: [0x00], expected: 0x00 },
    { input: [0x03], expected: 0x03 },
    { input: [0x51], expected: 0x51 },
    { input: [0x70], expected: 0x70 },
    { input: [0xff], expected: 0xff },
  ].forEach(({ input, expected }) => {
    it(createDecodesDescription(input, expected, 2), () => {
      const array = new Uint8Array(input);
      const reader = new MQTTReaderV5(array);

      expect(reader.readInteger(IntegerTypeV5.oneByte)).toBe(expected);
    });
  });
});

describe("MQTTReader.readInteger(IntegerType.twoByte)", () => {
  [
    { input: [0x00, 0x00], expected: 0x0000 },
    { input: [0x00, 0x0b], expected: 0x000b },
    { input: [0x01, 0x00], expected: 0x0100 },
    { input: [0x0d, 0x0e], expected: 0x0d0e },
    { input: [0xff, 0xff], expected: 0xffff },
  ].forEach(({ input, expected }) => {
    it(createDecodesDescription(input, expected, 4), () => {
      const array = new Uint8Array(input);
      const reader = new MQTTReaderV5(array);

      expect(reader.readInteger(IntegerTypeV5.twoByte)).toBe(expected);
    });
  });
});

describe("MQTTReader.readInteger(IntegerType.fourByte)", () => {
  [
    { input: [0x00, 0x00, 0x00, 0x00], expected: 0x00000000 },
    { input: [0x00, 0x00, 0x00, 0x02], expected: 0x00000002 },
    { input: [0x00, 0x00, 0x0e, 0x00], expected: 0x00000e00 },
    { input: [0x00, 0x48, 0x00, 0x00], expected: 0x00480000 },
    { input: [0x00, 0xff, 0xff, 0xff], expected: 0x00ffffff },
    { input: [0x01, 0x00, 0x00, 0x00], expected: 0x01000000 },
    { input: [0x01, 0x01, 0x01, 0x01], expected: 0x01010101 },
    { input: [0x0f, 0xdd, 0xee, 0xaa], expected: 0x0fddeeaa },
    { input: [0xaf, 0xdd, 0xee, 0xaa], expected: 0xafddeeaa },
    { input: [0xda, 0xdd, 0xee, 0xaa], expected: 0xdaddeeaa },
    { input: [0xff, 0xff, 0xff, 0xff], expected: 0xffffffff },
  ].forEach(({ input, expected }) => {
    it(createDecodesDescription(input, expected, 8), () => {
      const array = new Uint8Array(input);
      const reader = new MQTTReaderV5(array);

      expect(reader.readInteger(IntegerTypeV5.fourByte)).toBe(expected);
    });
  });
});

describe("MQTTReader.readInteger(IntegerType.variableByte)", () => {
  [
    { input: [0x00], expected: 0x00 },
    { input: [0x50], expected: 0x50 },
    { input: [0x7f], expected: 0x7f },

    { input: [0x80, 0x01], expected: 0x0080 },
    { input: [0xff, 0x01], expected: 0x00ff },
    { input: [0x80, 0x02], expected: 0x0100 },
    { input: [0xff, 0x7f], expected: 0x3fff },

    { input: [0x80, 0x80, 0x01], expected: 0x004000 },
    { input: [0xff, 0xff, 0x7f], expected: 0x1fffff },

    { input: [0x80, 0x80, 0x80, 0x01], expected: 0x00200000 },
    { input: [0xff, 0xff, 0xff, 0x7f], expected: 0x0fffffff },
  ].forEach(({ input, expected }) => {
    it(createDecodesDescription(input, expected, 8), () => {
      const array = new Uint8Array(input);
      const reader = new MQTTReaderV5(array);

      expect(reader.readInteger(IntegerTypeV5.variableByte)).toBe(expected);
    });
  });

  [
    { input: [], reason: "empty buffer" },
    { input: [0x80], reason: "incomplete sequence" },
    { input: [0xff], reason: "missing continuation byte" },
    { input: [0x80, 0x80, 0x80], reason: "incomplete sequence" },
    { input: [0xff, 0xff, 0xff, 0x80], reason: "missing 5th byte" },
    { input: [0x80, 0x80, 0x80, 0x80, 0x00], reason: "too many bytes" },

    /**
     * The encoded value MUST use the minimum number of bytes necessary to represent the value
     *
     * [MQTT-1.5.5-1]
     * https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html
     */
    { input: [0x80, 0x00], reason: "overlong encoding for 128" },
    { input: [0x81, 0x80, 0x00], reason: "overlong encoding for 1" },
    {
      input: [0x80, 0x00],
      reason: "overlong encoding for 0 (should be [0x00])",
    },
    {
      input: [0x81, 0x00],
      reason: "overlong encoding for 1 (should be [0x01])",
    },
    {
      input: [0xff, 0x00],
      reason: "overlong encoding for 127 (should be [0x7f])",
    },
    {
      input: [0x81, 0x80, 0x00],
      reason: "overlong encoding for 1 using 3 bytes (should be [0x01])",
    },
    {
      input: [0x80, 0x81, 0x00],
      reason: "overlong encoding for 128 (should be [0x80,0x01])",
    },
    {
      input: [0x80, 0x80, 0x80, 0x00],
      reason: "overlong encoding for 0 using 4 bytes (should be [0x00])",
    },
  ].forEach(({ input, reason }) => {
    it(`throws when ${reason}: ${arrayToHexString(input)}`, () => {
      const array = new Uint8Array(input);
      const reader = new MQTTReaderV5(array);

      expect(() => reader.readInteger(IntegerTypeV5.variableByte)).toThrowError(
        /Malformed/
      );
    });
  });
});

// helpers
const createDecodesDescription = (
  input: number[],
  expected: number,
  pad: number
) => `decodes ${arrayToHexString(input)} to ${uint8ToHexString(expected, pad)}`;
