import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parseMqttPacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parseMqttPacketV4";
import { SubackPacketV4 } from "@src/mqtt/protocol/v4/types";
import {
  createFixedHeader,
  createSubackFixedHeader,
} from "@tests/helpers/mqtt/protocol/createFixedHeader";
import { describe, it, expect } from "vitest";

//
// integration tests for parseSubackPacketV4 using MQTTReaderV4 with data buffers
//

describe("parseSubackPacketV4", () => {
  const fixedHeader = createSubackFixedHeader();

  it(`parses SUBACK packet`, () => {
    const remainingData = new Uint8Array([0x12, 0x34, 0x80]);
    const reader = new MQTTReaderV4(remainingData);
    const packet = parseMqttPacketV4(fixedHeader, reader);

    expect(packet.typeId).toBe(PacketType.SUBACK);
  });

  it("correctly parses Identifier value", () => {
    [
      { input: [0x00, 0x01, 0x00], expected: 1 },
      { input: [0x00, 0xff, 0x01], expected: 255 },
      { input: [0x01, 0x04, 0x02], expected: 260 },
      { input: [0x12, 0x34, 0x80], expected: 4660 },
      { input: [0xff, 0xff, 0x00], expected: 65535 },
    ].forEach(({ input, expected }) => {
      const remainingData = new Uint8Array(input);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parseMqttPacketV4(fixedHeader, reader) as SubackPacketV4;

      expect(packet.identifier).toBe(expected);
    });
  });

  it("correctly parses all Return Code values", () => {
    [
      { input: [0x00, 0x01, 0x00], expected: 0x00 },
      { input: [0x00, 0xff, 0x01], expected: 0x01 },
      { input: [0x01, 0x04, 0x02], expected: 0x02 },
      { input: [0x12, 0x34, 0x80], expected: 0x80 },
    ].forEach(({ input, expected }) => {
      const remainingData = new Uint8Array(input);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parseMqttPacketV4(fixedHeader, reader) as SubackPacketV4;

      expect(packet.returnCode).toBe(expected);
    });
  });

  // SUBACK return codes other than 0x00, 0x01, 0x02 and 0x80 are reserved and MUST NOT be used.
  // [MQTT-3.9.3-2]
  it(`throws an Error for invalid Return Code values`, () => {
    [0x03, 0x04, 0x05, 0x7f, 0x81, 0xfe, 0xff].forEach((invalidReturnCode) => {
      const remainingData = new Uint8Array([0x12, 0x34, invalidReturnCode]);
      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseMqttPacketV4(fixedHeader, reader)).toThrow(
        /Invalid SUBACK return code/
      );
    });
  });
});
