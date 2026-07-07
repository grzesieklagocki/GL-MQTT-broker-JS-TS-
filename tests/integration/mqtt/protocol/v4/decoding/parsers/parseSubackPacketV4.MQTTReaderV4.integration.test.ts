import { PacketType } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parseMqttPacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parseMqttPacketV4";
import {
  SubackPacketV4,
  SubackReturnCodeV4,
} from "@src/mqtt/protocol/v4/types";
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

  it("correctly parses a single Return Code as an array", () => {
    const fixedHeader = {
      packetType: PacketType.SUBACK,
      flags: 0,
      remainingLength: 3,
    };

    const remainingData = new Uint8Array([
      0x12,
      0x34, // Packet Identifier
      0x01, // Return Code
    ]);

    const reader = new MQTTReaderV4(remainingData);

    const packet = parseMqttPacketV4(fixedHeader, reader) as SubackPacketV4;

    expect(packet).toEqual({
      typeId: PacketType.SUBACK,
      identifier: 0x1234,
      returnCodeList: [SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1],
    });
  });

  it("correctly parses multiple Return Codes", () => {
    const fixedHeader = {
      packetType: PacketType.SUBACK,
      flags: 0,
      remainingLength: 6,
    };

    const remainingData = new Uint8Array([
      0x12,
      0x34, // Packet Identifier

      0x01, // Success - Maximum QoS 1
      0x00, // Success - Maximum QoS 0
      0x80, // Failure
      0x02, // Success - Maximum QoS 2
    ]);

    const reader = new MQTTReaderV4(remainingData);

    const packet = parseMqttPacketV4(fixedHeader, reader) as SubackPacketV4;

    expect(packet.identifier).toBe(0x1234);
    expect(packet.returnCodeList).toEqual([
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
      SubackReturnCodeV4.FAILURE,
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_2,
    ]);
  });

  it("correctly parses all valid Return Code values individually", () => {
    const cases = [
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_2,
      SubackReturnCodeV4.FAILURE,
    ];

    cases.forEach((returnCode) => {
      const fixedHeader = {
        packetType: PacketType.SUBACK,
        flags: 0,
        remainingLength: 3,
      };

      const remainingData = new Uint8Array([0x12, 0x34, returnCode]);

      const reader = new MQTTReaderV4(remainingData);

      const packet = parseMqttPacketV4(fixedHeader, reader) as SubackPacketV4;

      expect(packet.returnCodeList).toEqual([returnCode]);
    });
  });

  it("throws an Error if any Return Code is invalid", () => {
    const invalidReturnCodes = [0x03, 0x04, 0x05, 0x7f, 0x81, 0xfe, 0xff];

    invalidReturnCodes.forEach((invalidReturnCode) => {
      const fixedHeader = {
        packetType: PacketType.SUBACK,
        flags: 0,
        remainingLength: 5,
      };

      const remainingData = new Uint8Array([
        0x12,
        0x34, // Packet Identifier

        0x00, // valid
        invalidReturnCode, // invalid
        0x01, // valid, but parser should fail before accepting packet
      ]);

      const reader = new MQTTReaderV4(remainingData);

      expect(() => parseMqttPacketV4(fixedHeader, reader)).toThrow(
        /Invalid return code/
      );
    });
  });

  it("throws an Error when SUBACK contains no Return Codes", () => {
    const fixedHeader = {
      packetType: PacketType.SUBACK,
      flags: 0,
      remainingLength: 2,
    };

    const remainingData = new Uint8Array([
      0x12,
      0x34, // Packet Identifier only, no Return Codes
    ]);

    const reader = new MQTTReaderV4(remainingData);

    expect(() => parseMqttPacketV4(fixedHeader, reader)).toThrow(
      /at least one return code/
    );
  });
});
