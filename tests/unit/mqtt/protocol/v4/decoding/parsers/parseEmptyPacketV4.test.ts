import { PacketType } from "@mqtt/protocol/shared/types";
import { IMQTTReaderV4 } from "@mqtt/protocol/v4/types";
import { parseMqttPacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parseMqttPacketV4";
import { createEmptyPacketFixedHeader } from "@tests/helpers/mqtt/protocol/createFixedHeader";
import { describe, it, expect } from "vitest";

describe("parseEmptyPacketV4", () => {
  it(`parse PINGREQ, PINGRESP and DISCONNECT packets`, () => {
    [PacketType.PINGREQ, PacketType.PINGRESP, PacketType.DISCONNECT].forEach(
      (validPacketType) => {
        const fixedHeader = createEmptyPacketFixedHeader(validPacketType);
        const readerMock = { remaining: 0 } as unknown as IMQTTReaderV4;

        const packet = parseMqttPacketV4(fixedHeader, readerMock);

        expect(packet.typeId).toBe(validPacketType);
      }
    );
  });
});
