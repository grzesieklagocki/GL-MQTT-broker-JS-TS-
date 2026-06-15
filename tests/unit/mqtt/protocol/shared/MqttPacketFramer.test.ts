import { AppError } from "@src/AppError";
import { MqttPacketFramer } from "@mqtt/protocol/shared/MqttPacketFramer";
import {
  FixedHeader,
  IBinaryBuffer,
  IFixedHeaderParser,
  PacketType,
} from "@mqtt/protocol/shared/types";
import { describe, expect, it, vi } from "vitest";

describe("MqttPacketFramer", () => {
  describe("hasPacket", () => {
    it("returns false when fixed header is not available yet", () => {
      const { framer, parserMock, bufferMock } = createTestObject({
        fixedHeadersByParse: [undefined],
        bufferRemaining: 0,
      });

      expect(framer.hasPacket).toBe(false);

      expect(parserMock.parse).toHaveBeenCalledOnce();
      expect(parserMock.parse).toHaveBeenCalledWith(bufferMock.buffer);
    });

    it("returns false when fixed header is parsed but packet body is incomplete", () => {
      const fixedHeader = createFixedHeader(PacketType.PUBLISH, 5);

      const { framer, parserMock } = createTestObject({
        fixedHeadersByParse: [fixedHeader],
        bufferRemaining: 4,
      });

      expect(framer.hasPacket).toBe(false);

      expect(parserMock.parse).toHaveBeenCalledOnce();
    });

    it("returns true when fixed header is parsed and complete packet body is available", () => {
      const fixedHeader = createFixedHeader(PacketType.PUBLISH, 5);

      const { framer, parserMock } = createTestObject({
        fixedHeadersByParse: [fixedHeader],
        bufferRemaining: 5,
      });

      expect(framer.hasPacket).toBe(true);

      expect(parserMock.parse).toHaveBeenCalledOnce();
    });

    it("throws when fixed header parser fails", () => {
      const parserError = new AppError("Malformed Remaining Length.");

      const { framer, parserMock } = createTestObject({
        fixedHeadersByParse: [parserError],
        bufferRemaining: 0,
      });

      expect(() => framer.hasPacket).toThrow("Malformed Remaining Length.");

      expect(parserMock.parse).toHaveBeenCalled();
    });
  });

  describe("write", () => {
    it("delegates written bytes to buffer", () => {
      const { framer, bufferMock } = createTestObject();

      const bytes = new Uint8Array([0xc0, 0x00]);

      framer.write(bytes);

      expect(bufferMock.write).toHaveBeenCalledOnce();
      expect(bufferMock.write).toHaveBeenCalledWith(bytes);
    });
  });

  describe("readPacket", () => {
    it("throws when readPacket is called but no complete packet is available", () => {
      const { framer, bufferMock } = createTestObject({
        fixedHeadersByParse: [undefined],
        bufferRemaining: 0,
      });

      expect(() => framer.readPacket()).toThrow(
        "No complete packet available to read."
      );

      expect(bufferMock.read).not.toHaveBeenCalled();
    });

    it("reads packet with no restOfPacket when remaining length is 0", () => {
      const fixedHeader = createFixedHeader(PacketType.PINGREQ, 0);

      const { framer, parserMock, bufferMock } = createTestObject({
        fixedHeadersByParse: [fixedHeader],
        bufferRemaining: 0,
      });

      const [resultFixedHeader, restOfPacket] = framer.readPacket();

      expect(resultFixedHeader).toBe(fixedHeader);
      expect(restOfPacket).toBeUndefined();

      expect(parserMock.parse).toHaveBeenCalledOnce();
      expect(bufferMock.read).not.toHaveBeenCalled();
    });

    it("reads restOfPacket using remainingLength from fixed header", () => {
      const fixedHeader = createFixedHeader(PacketType.PUBLISH, 3);
      const restOfPacket = new Uint8Array([0x01, 0x02, 0x03]);

      const { framer, bufferMock } = createTestObject({
        fixedHeadersByParse: [fixedHeader],
        bufferRemaining: 3,
        readResults: [restOfPacket],
      });

      const [resultFixedHeader, resultRestOfPacket] = framer.readPacket();

      expect(resultFixedHeader).toBe(fixedHeader);
      expect(resultRestOfPacket).toBe(restOfPacket);

      expect(bufferMock.read).toHaveBeenCalledOnce();
      expect(bufferMock.read).toHaveBeenCalledWith(3);
    });

    it("resets fixed header state after readPacket", () => {
      const firstHeader = createFixedHeader(PacketType.PINGREQ, 0);
      const secondHeader = createFixedHeader(PacketType.DISCONNECT, 0);

      const { framer, parserMock } = createTestObject({
        fixedHeadersByParse: [firstHeader, secondHeader],
        bufferRemaining: 0,
      });

      const [firstResult] = framer.readPacket();

      expect(firstResult).toBe(firstHeader);
      expect(parserMock.parse).toHaveBeenCalledTimes(1);

      expect(framer.hasPacket).toBe(true);

      expect(parserMock.parse).toHaveBeenCalledTimes(2);

      const [secondResult] = framer.readPacket();

      expect(secondResult).toBe(secondHeader);
    });

    it("can read multiple packets one after another", () => {
      const firstHeader = createFixedHeader(PacketType.PINGREQ, 0);
      const secondHeader = createFixedHeader(PacketType.DISCONNECT, 0);

      const { framer, parserMock, bufferMock } = createTestObject({
        fixedHeadersByParse: [firstHeader, secondHeader],
        bufferRemaining: 0,
      });

      expect(framer.hasPacket).toBe(true);

      const [firstResult] = framer.readPacket();

      expect(firstResult).toBe(firstHeader);

      expect(framer.hasPacket).toBe(true);

      const [secondResult] = framer.readPacket();

      expect(secondResult).toBe(secondHeader);

      expect(parserMock.parse).toHaveBeenCalledTimes(2);
      expect(bufferMock.read).not.toHaveBeenCalled();
    });
  });

  it("does not parse fixed header again while waiting for the rest of the same packet", () => {
    const fixedHeader = createFixedHeader(PacketType.PUBLISH, 5);

    const { framer, parserMock, bufferMock } = createTestObject({
      fixedHeadersByParse: [fixedHeader],
      bufferRemaining: 4,
    });

    expect(framer.hasPacket).toBe(false);
    expect(parserMock.parse).toHaveBeenCalledOnce();

    bufferMock.setRemaining(5);

    expect(framer.hasPacket).toBe(true);
    expect(parserMock.parse).toHaveBeenCalledOnce();
  });
});

//
// Helpers for tests
//

type FixedHeaderParserResult = FixedHeader | undefined | Error;

// Create custom test object
function createTestObject(options?: {
  fixedHeadersByParse?: FixedHeaderParserResult[];
  bufferRemaining?: number;
  readResults?: Uint8Array[];
}) {
  const bufferMock = createBinaryBufferMock({
    remaining: options?.bufferRemaining ?? 0,
    readResults: options?.readResults ?? [],
  });

  const parserMock = createFixedHeaderParserMock(
    options?.fixedHeadersByParse ?? []
  );

  const framer = new MqttPacketFramer(parserMock.parser, bufferMock.buffer);

  return {
    framer,
    parserMock,
    bufferMock,
  };
}

function createBinaryBufferMock(options?: {
  remaining?: number;
  readResults?: Uint8Array[];
}) {
  let remaining = options?.remaining ?? 0;
  const readResults = [...(options?.readResults ?? [])];

  const write = vi.fn<(bytes: Uint8Array) => void>();

  const read = vi.fn<(length: number) => Uint8Array>((length) => {
    const result = readResults.shift();

    if (result) return result;

    return new Uint8Array(length);
  });

  const buffer = {
    write,
    read,

    get remaining() {
      return remaining;
    },
  } as unknown as IBinaryBuffer;

  return {
    buffer,
    write,
    read,

    setRemaining(value: number) {
      remaining = value;
    },
  };
}

function createFixedHeaderParserMock(results: FixedHeaderParserResult[]) {
  const parse = vi.fn<(buffer: IBinaryBuffer) => FixedHeader | undefined>(
    () => {
      const result = results.shift();

      if (result instanceof Error) {
        throw result;
      }

      return result;
    }
  );

  const parser = {
    parse,
  } as unknown as IFixedHeaderParser;

  return {
    parser,
    parse,
  };
}

function createFixedHeader(
  packetType: PacketType,
  remainingLength: number,
  flags = 0
): FixedHeader {
  return {
    packetType,
    flags,
    remainingLength,
  } as FixedHeader;
}
