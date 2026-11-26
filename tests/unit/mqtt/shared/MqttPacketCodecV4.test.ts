import { MqttPacketCodecV4 } from "@mqtt/shared/MqttPacketCodecV4";
import { PacketType } from "@mqtt/protocol/shared/types";
import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("MqttPacketCodecV4", () => {
  let codec: MqttPacketCodecV4;

  beforeEach(() => {
    codec = new MqttPacketCodecV4();
  });

  describe("encode()", () => {
    it("encodes PINGREQ packet", () => {
      const packet = {
        typeId: PacketType.PINGREQ,
      } as AnyPacketV4;

      expect(codec.encode(packet)).toEqual(
        new Uint8Array([
          0xc0, // PINGREQ fixed header
          0x00, // Remaining Length
        ])
      );
    });

    it("encodes PINGRESP packet", () => {
      const packet = {
        typeId: PacketType.PINGRESP,
      } as AnyPacketV4;

      expect(codec.encode(packet)).toEqual(
        new Uint8Array([
          0xd0, // PINGRESP fixed header
          0x00, // Remaining Length
        ])
      );
    });
  });

  describe("feed()", () => {
    // MQTT 3.1.1 Table 2.1.
    it.each([
      ["brokerToClient", 0xd0, PacketType.PINGRESP, 0xc0],
      ["clientToBroker", 0xc0, PacketType.PINGREQ, 0xd0],
    ] as const)(
      "enforces %s before and after reset",
      (flow, allowed, typeId, denied) => {
        const directionalCodec = new MqttPacketCodecV4(flow);
        const onPacketReady = vi.fn();
        directionalCodec.packetDecodedHandler = onPacketReady;

        for (const reset of [false, true]) {
          if (reset) directionalCodec.resetState();
          onPacketReady.mockClear();

          directionalCodec.feed(Uint8Array.of(allowed, 0));
          expect(() => directionalCodec.feed(Uint8Array.of(denied, 0))).toThrow(
            /Unsupported Fixed Header Packet Type/
          );
          expect(onPacketReady).toHaveBeenCalledExactlyOnceWith({ typeId });
        }
      }
    );

    it("calls packetDecodedHandler() when complete packet is received", () => {
      const onPacketReady = vi.fn(() => true);

      codec.packetDecodedHandler = onPacketReady as () => true | Error;

      codec.feed(
        new Uint8Array([
          0xd0, // PINGRESP
          0x00, // Remaining Length
        ])
      );

      expect(onPacketReady).toHaveBeenCalledExactlyOnceWith({
        typeId: PacketType.PINGRESP,
      });
    });

    it("provides decoder which returns decoded packet", () => {
      let decodedPacket: AnyPacketV4 | undefined;

      codec.packetDecodedHandler = (packet) => {
        decodedPacket = packet;
      };

      codec.feed(
        new Uint8Array([
          0xd0, // PINGRESP
          0x00,
        ])
      );

      expect(decodedPacket).toEqual({
        typeId: PacketType.PINGRESP,
      });
    });

    it("does not call packetReadyHandler() until complete packet is received", () => {
      const onPacketReady = vi.fn(() => true);

      codec.packetDecodedHandler = onPacketReady as () => true | Error;

      codec.feed(
        new Uint8Array([
          0xd0, // PINGRESP header only
        ])
      );

      expect(onPacketReady).not.toHaveBeenCalled();

      codec.feed(
        new Uint8Array([
          0x00, // Remaining Length
        ])
      );

      expect(onPacketReady).toHaveBeenCalledExactlyOnceWith({
        typeId: PacketType.PINGRESP,
      });
    });

    it("handles multiple packets received in a single buffer", () => {
      const receivedPacketTypes: PacketType[] = [];

      codec.packetDecodedHandler = (packet) => {
        receivedPacketTypes.push(packet.typeId);
      };

      codec.feed(
        new Uint8Array([
          0xc0, // PINGREQ
          0x00,
          0xd0, // PINGRESP
          0x00,
        ])
      );

      expect(receivedPacketTypes).toEqual([
        PacketType.PINGREQ,
        PacketType.PINGRESP,
      ]);
    });

    it("handles packets split across multiple buffers", () => {
      const decodedPackets: AnyPacketV4[] = [];

      codec.packetDecodedHandler = (packet) => {
        decodedPackets.push(packet);
      };

      codec.feed(new Uint8Array([0xc0]));
      codec.feed(new Uint8Array([0x00, 0xd0]));
      codec.feed(new Uint8Array([0x00]));

      expect(decodedPackets).toEqual([
        {
          typeId: PacketType.PINGREQ,
        },
        {
          typeId: PacketType.PINGRESP,
        },
      ]);
    });

    it("throws when packetDecodedHandler callback is not set", () => {
      expect(() => codec.feed(new Uint8Array([0xd0, 0x00]))).toThrow(
        "packetDecodedHandler callback is not set."
      );
    });
  });

  describe("resetState()", () => {
    it("clears partially received packet", () => {
      const onPacketReady = vi.fn(() => true);

      codec.packetDecodedHandler = onPacketReady as () => true | Error;

      // Begin receiving PINGRESP, but do not provide Remaining Length.
      codec.feed(new Uint8Array([0xd0]));

      codec.resetState();

      // This should now be interpreted as a new PINGREQ packet,
      // not as the second byte of the previous PINGRESP.
      codec.feed(new Uint8Array([0xc0, 0x00]));

      expect(onPacketReady).toHaveBeenCalledExactlyOnceWith({
        typeId: PacketType.PINGREQ,
      });
    });

    it("continues using packetDecodedHandler() callback after reset", () => {
      const onPacketReady = vi.fn(() => true);

      codec.packetDecodedHandler = onPacketReady as () => true | Error;

      codec.resetState();

      codec.feed(new Uint8Array([0xd0, 0x00]));

      expect(onPacketReady).toHaveBeenCalledExactlyOnceWith({
        typeId: PacketType.PINGRESP,
      });
    });
  });
});
