import { PacketType, PacketWithIdentifier } from "@mqtt/protocol/shared/types";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { parseMqttPacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parseMqttPacketV4";
import { createPacketWithIdentifierFixedHeader } from "@tests/helpers/mqtt/protocol/createFixedHeader";
import { describe, it, expect } from "vitest";

//
// integration tests for parsePacketWithIdentifierV4 using MQTTReaderV4 with data buffers
//

describe("parsePacketWithIdentifierV4", () => {
  it(`parses PUBACK, PUBREC, PUBREL, PUBCOMP and UNSUBACK packets`, () => {
    [
      PacketType.PUBACK,
      PacketType.PUBREC,
      PacketType.PUBREL,
      PacketType.PUBCOMP,
      PacketType.UNSUBACK,
    ].forEach((validPacketType) => {
      const fixedHeader = createPacketWithIdentifierFixedHeader(
        validPacketType,
        validPacketType === PacketType.PUBREL ? 0b0010 : 0b0000
      );
      const remainingData = new Uint8Array([0x12, 0x34]);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parseMqttPacketV4(fixedHeader, reader);

      expect(packet.typeId).toBe(validPacketType);
    });
  });

  it("correctly parses Identifier value", () => {
    [
      { input: [0x00, 0x01], expected: 1 },
      { input: [0x00, 0xff], expected: 255 },
      { input: [0x01, 0x04], expected: 260 },
      { input: [0x12, 0x34], expected: 4660 },
      { input: [0xff, 0xff], expected: 65535 },
    ].forEach(({ input, expected }) => {
      const fixedHeader = createPacketWithIdentifierFixedHeader(
        PacketType.PUBACK
      );
      const remainingData = new Uint8Array(input);
      const reader = new MQTTReaderV4(remainingData);
      const packet = parseMqttPacketV4(
        fixedHeader,
        reader
      ) as PacketWithIdentifier<PacketType.PUBACK>;

      expect(packet.identifier).toBe(expected);
    });
  });
});
