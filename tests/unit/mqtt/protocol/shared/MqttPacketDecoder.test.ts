import { describe, expect, it, vi } from "vitest";
import {
  AnyPacket,
  FixedHeader,
  IMqttPacketFramer,
  PacketType,
} from "@src/mqtt/protocol/shared/types";
import {
  MqttPacketDecoder,
  MqttPacketParser,
} from "@src/mqtt/protocol/shared/MqttPacketDecoder";

describe("MqttPacketDecoder.write", () => {
  it("does nothing for empty chunks", () => {
    const { decoder, framer, parseFunction, onPacketFramed, onPacketParsed } =
      createTestObject();

    decoder.write(new Uint8Array());

    expect(framer.write).not.toHaveBeenCalled();
    expect(framer.readPacket).not.toHaveBeenCalled();

    expect(parseFunction).not.toHaveBeenCalled();
    expect(onPacketFramed).not.toHaveBeenCalled();
    expect(onPacketParsed).not.toHaveBeenCalled();
  });

  it("passes non-empty chunk to framer", () => {
    const { decoder, framer, parseFunction } = createTestObject();

    const chunk = new Uint8Array([0xc0]);

    decoder.write(chunk);

    expect(framer.write).toHaveBeenCalledOnce();
    expect(framer.write).toHaveBeenCalledWith(chunk);
    expect(framer.readPacket).not.toHaveBeenCalled();

    expect(parseFunction).not.toHaveBeenCalled();
  });

  it("does not parse anything when framer has no complete packet", () => {
    const { decoder, framer, parseFunction, onPacketFramed, onPacketParsed } =
      createTestObject({
        packetsByWrite: [[]],
      });

    decoder.write(new Uint8Array([0xc0]));

    expect(framer.write).toHaveBeenCalledOnce();
    expect(framer.readPacket).not.toHaveBeenCalled();

    expect(parseFunction).not.toHaveBeenCalled();

    expect(onPacketFramed).not.toHaveBeenCalled();
    expect(onPacketParsed).not.toHaveBeenCalled();
  });

  it("reads, parses and emits callbacks for one complete packet", () => {
    const fixedHeader = createFixedHeaderMock(PacketType.PINGREQ, 0);
    const restOfPacket = new Uint8Array();
    const parsedPacket = createPacketMock(PacketType.PINGREQ);

    const { decoder, framer, parseFunction, onPacketFramed, onPacketParsed } =
      createTestObject({
        packetsByWrite: [[[fixedHeader, restOfPacket]]],
        parsedPackets: [parsedPacket],
      });

    decoder.write(new Uint8Array([0xc0, 0x00]));

    expect(framer.write).toHaveBeenCalledOnce();
    expect(framer.readPacket).toHaveBeenCalledOnce();

    expect(onPacketFramed).toHaveBeenCalledOnce();
    expect(onPacketFramed).toHaveBeenCalledWith(fixedHeader);

    expect(parseFunction).toHaveBeenCalledOnce();
    expect(parseFunction).toHaveBeenCalledWith(fixedHeader, restOfPacket);

    expect(onPacketParsed).toHaveBeenCalledOnce();
    expect(onPacketParsed).toHaveBeenCalledWith(parsedPacket);
  });

  it("passes undefined restOfPacket to parser when framer returns no rest", () => {
    const fixedHeader = createFixedHeaderMock(PacketType.DISCONNECT, 0);
    const parsedPacket = createPacketMock(PacketType.DISCONNECT);

    const { decoder, parseFunction, onPacketParsed } = createTestObject({
      packetsByWrite: [[[fixedHeader, undefined]]],
      parsedPackets: [parsedPacket],
    });

    decoder.write(new Uint8Array([0xe0, 0x00]));

    expect(parseFunction).toHaveBeenCalledOnce();
    expect(parseFunction).toHaveBeenCalledWith(fixedHeader, undefined);

    expect(onPacketParsed).toHaveBeenCalledWith(parsedPacket);
  });

  it("drains all packets available from framer after one write", () => {
    const fixedHeader1 = createFixedHeaderMock(PacketType.DISCONNECT, 0);
    const fixedHeader2 = createFixedHeaderMock(PacketType.PINGRESP, 0);

    const parsedPacket1 = createPacketMock(PacketType.DISCONNECT);
    const parsedPacket2 = createPacketMock(PacketType.PINGRESP);

    const { decoder, framer, parseFunction, onPacketFramed, onPacketParsed } =
      createTestObject({
        packetsByWrite: [
          [
            [fixedHeader1, undefined],
            [fixedHeader2, undefined],
          ],
        ],
        parsedPackets: [parsedPacket1, parsedPacket2],
      });

    decoder.write(new Uint8Array([0xe0, 0x00, 0xd0, 0x00]));

    expect(framer.readPacket).toHaveBeenCalledTimes(2);

    expect(parseFunction).toHaveBeenCalledTimes(2);

    expect(onPacketFramed).toHaveBeenNthCalledWith(1, fixedHeader1);
    expect(onPacketFramed).toHaveBeenNthCalledWith(2, fixedHeader2);

    expect(onPacketParsed).toHaveBeenNthCalledWith(1, parsedPacket1);
    expect(onPacketParsed).toHaveBeenNthCalledWith(2, parsedPacket2);
  });

  it("can parse a packet only after a later write makes it available in framer", () => {
    const fixedHeader = createFixedHeaderMock(PacketType.PINGREQ, 0);
    const parsedPacket = createPacketMock(PacketType.PINGREQ);

    const { decoder, framer, parseFunction, onPacketParsed } = createTestObject(
      {
        packetsByWrite: [[], [[fixedHeader, undefined]]],
        parsedPackets: [parsedPacket],
      }
    );

    decoder.write(new Uint8Array([0xc0]));

    expect(framer.write).toHaveBeenCalledTimes(1);
    expect(framer.readPacket).not.toHaveBeenCalled();

    expect(parseFunction).not.toHaveBeenCalled();
    expect(onPacketParsed).not.toHaveBeenCalled();

    decoder.write(new Uint8Array([0x00]));

    expect(framer.write).toHaveBeenCalledTimes(2);
    expect(framer.readPacket).toHaveBeenCalledOnce();

    expect(parseFunction).toHaveBeenCalledOnce();

    expect(onPacketParsed).toHaveBeenCalledOnce();
    expect(onPacketParsed).toHaveBeenCalledWith(parsedPacket);
  });

  it("calls callbacks in correct order for every packet", () => {
    const fixedHeader1 = createFixedHeaderMock(PacketType.DISCONNECT, 0);
    const fixedHeader2 = createFixedHeaderMock(PacketType.PINGRESP, 0);

    const parsedPacket1 = createPacketMock(PacketType.DISCONNECT);
    const parsedPacket2 = createPacketMock(PacketType.PINGRESP);

    const events: string[] = [];

    const framer = createFramerMock([
      [
        [fixedHeader1, undefined],
        [fixedHeader2, undefined],
      ],
    ]);

    const parseFunction = vi.fn<MqttPacketParser>((fixedHeader) => {
      events.push(`parse:${fixedHeader.packetType}`);

      if (fixedHeader === fixedHeader1) return parsedPacket1;
      if (fixedHeader === fixedHeader2) return parsedPacket2;

      throw new Error("Unexpected fixed header");
    });

    const decoder = new MqttPacketDecoder(framer, parseFunction);

    decoder.onPacketFramed = (fixedHeader) => {
      events.push(`framed:${fixedHeader.packetType}`);
    };

    decoder.onPacketParsed = (packet) => {
      events.push(`parsed:${packet.typeId}`);
    };

    decoder.write(new Uint8Array([0xe0, 0x00, 0xd0, 0x00]));

    expect(events).toStrictEqual([
      `framed:${PacketType.DISCONNECT}`,
      `parse:${PacketType.DISCONNECT}`,
      `parsed:${PacketType.DISCONNECT}`,

      `framed:${PacketType.PINGRESP}`,
      `parse:${PacketType.PINGRESP}`,
      `parsed:${PacketType.PINGRESP}`,
    ]);
  });

  it("does not require event handlers to be assigned manually", () => {
    const fixedHeader = createFixedHeaderMock(PacketType.PINGREQ, 0);
    const parsedPacket = createPacketMock(PacketType.PINGREQ);

    const framer = createFramerMock([[[fixedHeader, undefined]]]);
    const parseFunction = vi.fn<MqttPacketParser>(() => parsedPacket);

    const decoder = new MqttPacketDecoder(framer, parseFunction);

    expect(() => decoder.write(new Uint8Array([0xc0, 0x00]))).not.toThrow();

    expect(parseFunction).toHaveBeenCalledOnce();
  });

  it("propagates parser errors and does not emit parsed callback", () => {
    const fixedHeader = createFixedHeaderMock(PacketType.PUBLISH, 5);

    const framer = createFramerMock([
      [[fixedHeader, new Uint8Array([1, 2, 3])]],
    ]);

    const parseFunction = vi.fn<MqttPacketParser>(() => {
      throw new Error("parse failed");
    });

    const decoder = new MqttPacketDecoder(framer, parseFunction);

    const onPacketFramed = vi.fn();
    const onPacketParsed = vi.fn();

    decoder.onPacketFramed = onPacketFramed;
    decoder.onPacketParsed = onPacketParsed;

    expect(() => decoder.write(new Uint8Array([0x30, 0x03, 1, 2, 3]))).toThrow(
      "parse failed"
    );

    expect(onPacketFramed).toHaveBeenCalledOnce();
    expect(onPacketFramed).toHaveBeenCalledWith(fixedHeader);

    expect(onPacketParsed).not.toHaveBeenCalled();
  });
});

//
// Helpers for tests
//

type FramedPacket = [FixedHeader, Uint8Array | undefined];

// Create custom test object
function createTestObject(options?: {
  packetsByWrite?: FramedPacket[][]; // array of packets returned by framer for each write call
  parsedPackets?: AnyPacket[]; // array of packets returned by parseFunction for each call
}) {
  const framer = createFramerMock(options?.packetsByWrite ?? []);
  const parsedPackets = [...(options?.parsedPackets ?? [])];

  const parseFunction = vi.fn<MqttPacketParser>(() => {
    const packet = parsedPackets.shift();

    if (!packet) {
      throw new Error("parseFunction called without prepared parsed packet");
    }

    return packet;
  });

  const decoder = new MqttPacketDecoder(framer, parseFunction);

  const onPacketFramed = vi.fn();
  const onPacketParsed = vi.fn();

  decoder.onPacketFramed = onPacketFramed;
  decoder.onPacketParsed = onPacketParsed;

  return {
    decoder,
    framer,
    parseFunction,
    onPacketFramed,
    onPacketParsed,
  };
}

function createFramerMock(
  packetsByWrite: FramedPacket[][] = [] // array of packets returned by framer for each write call
): IMqttPacketFramer {
  const readyPackets: FramedPacket[] = [];
  let writeIndex = 0;

  const framer = {
    write: vi.fn((_chunk: Uint8Array) => {
      readyPackets.push(...(packetsByWrite[writeIndex++] ?? []));
    }),

    readPacket: vi.fn(() => {
      const packet = readyPackets.shift();

      if (!packet) {
        throw new Error("readPacket called when no packet is available");
      }

      return packet;
    }),

    get hasPacket() {
      return readyPackets.length > 0;
    },
  };

  return framer;
}

function createFixedHeaderMock(
  packetType: PacketType,
  remainingLength: number
): FixedHeader {
  return {
    packetType,
    remainingLength,
  } as FixedHeader;
}

function createPacketMock(typeId: PacketType): AnyPacket {
  return {
    typeId,
  } as AnyPacket;
}
