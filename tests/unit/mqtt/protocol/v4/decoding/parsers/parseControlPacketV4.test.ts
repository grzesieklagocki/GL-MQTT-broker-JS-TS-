import { FixedHeader, PacketType } from "@mqtt/protocol/shared/types";
import { parseControlPacketV4 } from "@src/mqtt/protocol/v4/decoding/parsers/parseControlPacketV4";
import { IMQTTReaderV4 } from "@src/mqtt/protocol/v4/types";
import { describe, expect, it, vi } from "vitest";
import * as connectParser from "@mqtt/protocol/v4/decoding/parsers/parseConnectPacketV4";
import * as connackParser from "@mqtt/protocol/v4/decoding/parsers/parseConnackPacketV4";
import * as publishParser from "@mqtt/protocol/v4/decoding/parsers/parsePublishPacketV4";
import * as withIdParser from "@mqtt/protocol/v4/decoding/parsers/parsePacketWithIdentifierV4";
import * as subscribeParser from "@mqtt/protocol/v4/decoding/parsers/parseSubscribePacketV4";
import * as subackParser from "@mqtt/protocol/v4/decoding/parsers/parseSubackPacketV4";
import * as unsubscribeParser from "@mqtt/protocol/v4/decoding/parsers/parseUnsubscribePacketV4";
import * as emptyParser from "@mqtt/protocol/v4/decoding/parsers/parseEmptyPacketV4";
import { MQTTReaderV4 } from "@src/mqtt/protocol/v4/decoding/MQTTReaderV4";

describe("parseControlPacketV4", () => {
  describe("calls correct parser with correct arguments", () => {
    // for easy access to parsers and method names
    const parserInfo = {
      connect: { parser: connectParser, methodName: "parseConnectPacketV4" },
      connack: { parser: connackParser, methodName: "parseConnackPacketV4" },
      publish: { parser: publishParser, methodName: "parsePublishPacketV4" },
      withId: {
        parser: withIdParser,
        methodName: "parsePacketWithIdentifierV4",
      },
      subscribe: {
        parser: subscribeParser,
        methodName: "parseSubscribePacketV4",
      },
      suback: { parser: subackParser, methodName: "parseSubackPacketV4" },
      unsubscribe: {
        parser: unsubscribeParser,
        methodName: "parseUnsubscribePacketV4",
      },
      empty: { parser: emptyParser, methodName: "parseEmptyPacketV4" },
    };

    // tests for each packet type
    [
      {
        packetType: PacketType.CONNECT,
        parserInfo: parserInfo.connect,
      },
      {
        packetType: PacketType.CONNACK,
        parserInfo: parserInfo.connack,
      },
      {
        packetType: PacketType.PUBLISH,
        parserInfo: parserInfo.publish,
      },
      {
        packetType: PacketType.PUBACK,
        parserInfo: parserInfo.withId,
      },
      {
        packetType: PacketType.PUBREC,
        parserInfo: parserInfo.withId,
      },
      {
        packetType: PacketType.PUBREL,
        parserInfo: parserInfo.withId,
      },
      {
        packetType: PacketType.PUBCOMP,
        parserInfo: parserInfo.withId,
      },
      {
        packetType: PacketType.SUBSCRIBE,
        parserInfo: parserInfo.subscribe,
      },
      {
        packetType: PacketType.SUBACK,
        parserInfo: parserInfo.suback,
      },
      {
        packetType: PacketType.UNSUBSCRIBE,
        parserInfo: parserInfo.unsubscribe,
      },
      {
        packetType: PacketType.UNSUBACK,
        parserInfo: parserInfo.withId,
      },
      {
        packetType: PacketType.PINGREQ,
        parserInfo: parserInfo.empty,
      },
      {
        packetType: PacketType.PINGRESP,
        parserInfo: parserInfo.empty,
      },
      {
        packetType: PacketType.DISCONNECT,
        parserInfo: parserInfo.empty,
      },
    ].forEach(({ packetType, parserInfo }) => {
      it(`calls ${parserInfo.methodName} for ${PacketType[packetType]} (${packetType})`, () => {
        // spy on the parser method
        const spy = vi
          .spyOn(parserInfo.parser, parserInfo.methodName as never)
          .mockImplementation((_header, _reader: any) => {
            return { typeId: packetType } as any;
          });

        // create mocks
        const fixedHeader = createFixedHeaderMock(packetType);
        const remainingData = createIMQTTReaderV4Mock();

        const packet = parseControlPacketV4(fixedHeader, remainingData);

        // checks for correct parser call
        expect(spy).toHaveBeenCalledExactlyOnceWith(fixedHeader, remainingData);
        expect(packet.typeId).toBe(packetType);

        spy.mockRestore();
      });
    });
  });
  describe("Remaining Length validation", () => {
    it("throws when Remaining Length declared in Fixed Header not matching Remaining Length in reader", () => {
      [
        [0, 1],
        [1, 0],
        [5, 3],
        [10, 15],
      ].forEach(([declaredLength, actualLength]) => {
        const fixedHeader = createFixedHeaderMock(
          PacketType.CONNECT,
          declaredLength
        );
        const remainingData = createIMQTTReaderV4Mock(actualLength);

        expect(() => parseControlPacketV4(fixedHeader, remainingData)).toThrow(
          /Remaining/
        );
      });
    });

    it("throws when after parsing still bytes remain in the reader", () => {
      [1, 2, 5, 10].forEach((remaining) => {
        const fixedHeader = createFixedHeaderMock(
          PacketType.DISCONNECT,
          remaining
        );
        const remainingData = createIMQTTReaderV4Mock(remaining);

        expect(() => parseControlPacketV4(fixedHeader, remainingData)).toThrow(
          /Bytes remain/
        );
      });
    });
  });
});

//
// helper functions
//

// creates a FixedHeader mock with given PacketType and Remaining Length
function createFixedHeaderMock(type: PacketType, remaining = 0): FixedHeader {
  return {
    packetType: type,
    remainingLength: remaining,
  } as unknown as FixedHeader;
}

// creates a IMQTTReaderV4 mock with given remaining length
function createIMQTTReaderV4Mock(remaining = 0): IMQTTReaderV4 {
  return { remaining: remaining } as unknown as MQTTReaderV4;
}
