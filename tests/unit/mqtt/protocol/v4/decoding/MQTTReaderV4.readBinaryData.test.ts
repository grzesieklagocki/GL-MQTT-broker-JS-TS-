import { describe, expect, it } from "vitest";
import { arrayToHexString } from "@mqtt/protocol/shared/testHelpers";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";

describe("MQTTReader.readBinaryData", () => {
  [
    { input: [0x00, 0x00], expected: [] }, // length = 0: empty data
    { input: [0x00, 0x01, 0xaa], expected: [0xaa] }, // length = 1: single byte
    { input: [0x00, 0x02, 0xde, 0xad], expected: [0xde, 0xad] }, // length = 2: two bytes
    { input: [0x00, 0x03, 0x23, 0x45, 0x56], expected: [0x23, 0x45, 0x56] }, // length = 3: three bytes
    {
      input: [0x00, 0x04, 0x12, 0x34, 0x56, 0x78],
      expected: [0x12, 0x34, 0x56, 0x78],
    }, // length = 4: multi–byte sequence
  ].forEach(({ input, expected }) => {
    it(`decodes ${arrayToHexString(input)} to ${arrayToHexString(
      expected
    )}`, () => {
      const array = new Uint8Array(input);
      const reader = new MQTTReaderV4(array);

      expect(reader.readBinaryData()).toStrictEqual(new Uint8Array(expected));
    });
  });

  [
    { input: [], reason: "empty buffer" },
    { input: [0x00], reason: "missing second length byte (incomplete header)" },
    { input: [0x00, 0x01], reason: "length = 1, but no data bytes" },
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
      const array = new Uint8Array(input);
      const reader = new MQTTReaderV4(array);

      expect(() => reader.readBinaryData()).toThrowError(/Malformed/);
    });
  });
});
