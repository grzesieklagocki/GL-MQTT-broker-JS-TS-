import { describe, expect, it, vi } from "vitest";
import {
  AnyPacket,
  FixedHeader,
  IMqttPacketFramer,
  PacketType,
} from "@mqtt/protocol/shared/types";
import {
  MqttPacketDecoder,
  MqttPacketParser,
} from "@mqtt/protocol/shared/MqttPacketDecoder";

describe("MqttPacketDecoder.write", () => {
  it("does nothing for empty chunks", () => {
    const { decoder, framer, parseFunction, onPacketReady } =
      createTestObject();

    decoder.write(new Uint8Array());

    expect(framer.write).not.toHaveBeenCalled();
    expect(framer.readPacket).not.toHaveBeenCalled();

    expect(parseFunction).not.toHaveBeenCalled();
    expect(onPacketReady).not.toHaveBeenCalled();
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

  it("does not read anything when framer has no complete packet", () => {
    const { decoder, framer, parseFunction, onPacketReady } = createTestObject({
      packetsByWrite: [[]],
    });

    decoder.write(new Uint8Array([0xc0]));

    expect(framer.write).toHaveBeenCalledOnce();
    expect(framer.readPacket).not.toHaveBeenCalled();

    expect(parseFunction).not.toHaveBeenCalled();
    expect(onPacketReady).not.toHaveBeenCalled();
  });

  it("emits onPacketReady with packet type and a lazy decode function for one complete packet", () => {
    const fixedHeader = createFixedHeaderMock(PacketType.PINGREQ, 0);
    const restOfPacket = new Uint8Array();
    const parsedPacket = createPacketMock(PacketType.PINGREQ);

    const { decoder, framer, parseFunction, onPacketReady } = createTestObject({
      packetsByWrite: [[[fixedHeader, restOfPacket]]],
      parsedPackets: [parsedPacket],
    });

    decoder.write(new Uint8Array([0xc0, 0x00]));

    expect(framer.write).toHaveBeenCalledOnce();
    expect(framer.readPacket).toHaveBeenCalledExactlyOnceWith();

    // parsing is lazy: parseFunction must not run until decodePacket() is called
    expect(parseFunction).not.toHaveBeenCalled();

    expect(onPacketReady).toHaveBeenCalledOnce();

    const [packetType, decodePacket] = onPacketReady.mock.calls[0];

    expect(packetType).toBe(PacketType.PINGREQ);
    expect(decodePacket).toBeInstanceOf(Function);

    expect(decodePacket()).toBe(parsedPacket);
    expect(parseFunction).toHaveBeenCalledExactlyOnceWith(
      fixedHeader,
      restOfPacket
    );
  });

  it("passes undefined restOfPacket to parser when framer returns no rest", () => {
    const fixedHeader = createFixedHeaderMock(PacketType.DISCONNECT, 0);
    const parsedPacket = createPacketMock(PacketType.DISCONNECT);

    const { decoder, parseFunction, onPacketReady } = createTestObject({
      packetsByWrite: [[[fixedHeader, undefined]]],
      parsedPackets: [parsedPacket],
    });

    decoder.write(new Uint8Array([0xe0, 0x00]));

    const [, decodePacket] = onPacketReady.mock.calls[0];

    expect(decodePacket()).toBe(parsedPacket);
    expect(parseFunction).toHaveBeenCalledExactlyOnceWith(
      fixedHeader,
      undefined
    );
  });

  it("drains all packets available from framer after one write", () => {
    const fixedHeader1 = createFixedHeaderMock(PacketType.DISCONNECT, 0);
    const fixedHeader2 = createFixedHeaderMock(PacketType.PINGRESP, 0);

    const parsedPacket1 = createPacketMock(PacketType.DISCONNECT);
    const parsedPacket2 = createPacketMock(PacketType.PINGRESP);

    const { decoder, framer, parseFunction, onPacketReady } = createTestObject({
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
    expect(onPacketReady).toHaveBeenCalledTimes(2);

    expect(onPacketReady.mock.calls[0][0]).toBe(PacketType.DISCONNECT);
    expect(onPacketReady.mock.calls[1][0]).toBe(PacketType.PINGRESP);

    expect(onPacketReady.mock.calls[0][1]()).toBe(parsedPacket1);
    expect(onPacketReady.mock.calls[1][1]()).toBe(parsedPacket2);

    expect(parseFunction).toHaveBeenCalledTimes(2);
  });

  it("can read a packet only after a later write makes it available in framer", () => {
    const fixedHeader = createFixedHeaderMock(PacketType.PINGREQ, 0);
    const parsedPacket = createPacketMock(PacketType.PINGREQ);

    const { decoder, framer, parseFunction, onPacketReady } = createTestObject({
      packetsByWrite: [[], [[fixedHeader, undefined]]],
      parsedPackets: [parsedPacket],
    });

    decoder.write(new Uint8Array([0xc0]));

    expect(framer.write).toHaveBeenCalledTimes(1);
    expect(framer.readPacket).not.toHaveBeenCalled();
    expect(onPacketReady).not.toHaveBeenCalled();

    decoder.write(new Uint8Array([0x00]));

    expect(framer.write).toHaveBeenCalledTimes(2);
    expect(framer.readPacket).toHaveBeenCalledOnce();

    expect(onPacketReady).toHaveBeenCalledOnce();
    expect(onPacketReady.mock.calls[0][0]).toBe(PacketType.PINGREQ);

    expect(parseFunction).not.toHaveBeenCalled();
    expect(onPacketReady.mock.calls[0][1]()).toBe(parsedPacket);
    expect(parseFunction).toHaveBeenCalledOnce();
  });

  it("calls onPacketReady in order for every packet, with decoding deferred until invoked", () => {
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

    decoder.onPacketReady = (packetType, decodePacket) => {
      events.push(`ready:${packetType}`);
      events.push(`parsed:${decodePacket().typeId}`);
    };

    decoder.write(new Uint8Array([0xe0, 0x00, 0xd0, 0x00]));

    expect(events).toStrictEqual([
      `ready:${PacketType.DISCONNECT}`,
      `parse:${PacketType.DISCONNECT}`,
      `parsed:${PacketType.DISCONNECT}`,

      `ready:${PacketType.PINGRESP}`,
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

    expect(parseFunction).not.toHaveBeenCalled();
  });

  it("propagates parser errors only when decodePacket is invoked", () => {
    const fixedHeader = createFixedHeaderMock(PacketType.PUBLISH, 5);

    const framer = createFramerMock([
      [[fixedHeader, new Uint8Array([1, 2, 3])]],
    ]);

    const parseFunction = vi.fn<MqttPacketParser>(() => {
      throw new Error("parse failed");
    });

    const decoder = new MqttPacketDecoder(framer, parseFunction);

    const onPacketReady = vi.fn();
    decoder.onPacketReady = onPacketReady;

    expect(() =>
      decoder.write(new Uint8Array([0x30, 0x03, 1, 2, 3]))
    ).not.toThrow();

    expect(onPacketReady).toHaveBeenCalledOnce();

    const [, decodePacket] = onPacketReady.mock.calls[0];

    expect(decodePacket).toThrow("parse failed");
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

  const onPacketReady = vi.fn();

  decoder.onPacketReady = onPacketReady;

  return {
    decoder,
    framer,
    parseFunction,
    onPacketReady,
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
