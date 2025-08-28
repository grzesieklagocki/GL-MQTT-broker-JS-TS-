import { describe, it, expect } from "vitest";
import { PacketType } from "@mqtt/protocol/shared/types";
import { getParserFor } from "@mqtt/protocol/v4/decoding/parseControlPacketV4";
import { parseConnackPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseConnackPacketV4";
import { parseConnectPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseConnectPacketV4";
import { parseEmptyPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseEmptyPacketV4";
import { parsePacketWithIdentifierV4 } from "@mqtt/protocol/v4/decoding/parsers/parsePacketWithIdentifierV4";
import { parsePublishPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parsePublishPacketV4";
import { parseSubackPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseSubackPacketV4";
import { parseSubscribePacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseSubscribePacketV4.";
import { parseUnsubscribePacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseUnsubscribePacketV4";

describe("getParserFor", () => {
  it("returns the correct parser for each packet type", () => {
    expect(getParserFor(PacketType.CONNECT)).toBe(parseConnectPacketV4);
    expect(getParserFor(PacketType.CONNACK)).toBe(parseConnackPacketV4);
    expect(getParserFor(PacketType.PUBLISH)).toBe(parsePublishPacketV4);
    expect(getParserFor(PacketType.PUBACK)).toBe(parsePacketWithIdentifierV4);
    expect(getParserFor(PacketType.PUBREC)).toBe(parsePacketWithIdentifierV4);
    expect(getParserFor(PacketType.PUBREL)).toBe(parsePacketWithIdentifierV4);
    expect(getParserFor(PacketType.PUBCOMP)).toBe(parsePacketWithIdentifierV4);
    expect(getParserFor(PacketType.SUBSCRIBE)).toBe(parseSubscribePacketV4);
    expect(getParserFor(PacketType.SUBACK)).toBe(parseSubackPacketV4);
    expect(getParserFor(PacketType.UNSUBSCRIBE)).toBe(parseUnsubscribePacketV4);
    expect(getParserFor(PacketType.UNSUBACK)).toBe(parsePacketWithIdentifierV4);
    expect(getParserFor(PacketType.PINGREQ)).toBe(parseEmptyPacketV4);
    expect(getParserFor(PacketType.PINGRESP)).toBe(parseEmptyPacketV4);
    expect(getParserFor(PacketType.DISCONNECT)).toBe(parseEmptyPacketV4);
  });
  it("throws an Error for unknown packet types", () => {
    expect(() => getParserFor(0 as PacketType)).toThrow(/Unknown/);
    expect(() => getParserFor(15 as PacketType)).toThrow(/Unknown/);
  });
});
