import { describe, expect, it } from "vitest";
import { encodeFixedHeaderV4 } from "@src/mqtt/protocol/v4/encoding/encodeFixedHeaderV4";
import { FixedHeader, PacketType } from "@src/mqtt/protocol/shared/types";

const expectBytes = (actual: Uint8Array, expected: number[]) => {
  expect([...actual]).toEqual(expected);
};

describe("encodeFixedHeaderV4()", () => {
  describe("valid fixed headers", () => {
    it("should encode PINGREQ fixed header", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PINGREQ,
        flags: 0,
        remainingLength: 0,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [
        0xc0, // PINGREQ type 12, flags 0000
        0x00, // Remaining Length = 0
      ]);
    });

    it("should encode DISCONNECT fixed header", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.DISCONNECT,
        flags: 0,
        remainingLength: 0,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [
        0xe0, // DISCONNECT type 14, flags 0000
        0x00,
      ]);
    });

    it("should encode PUBREL fixed header with required flags 0010", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBREL,
        flags: 0b0010,
        remainingLength: 2,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [
        0x62, // PUBREL type 6, flags 0010
        0x02,
      ]);
    });

    it("should encode SUBSCRIBE fixed header with required flags 0010", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0010,
        remainingLength: 8,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [
        0x82, // SUBSCRIBE type 8, flags 0010
        0x08,
      ]);
    });

    it("should encode UNSUBSCRIBE fixed header with required flags 0010", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.UNSUBSCRIBE,
        flags: 0b0010,
        remainingLength: 7,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [
        0xa2, // UNSUBSCRIBE type 10, flags 0010
        0x07,
      ]);
    });

    it("should encode PUBLISH fixed header with QoS 0 and retain false", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBLISH,
        flags: 0b0000,
        remainingLength: 5,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [
        0x30, // PUBLISH type 3, flags 0000
        0x05,
      ]);
    });

    it("should encode PUBLISH fixed header with DUP, QoS 2 and RETAIN", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBLISH,
        flags: 0b1101, // DUP=1, QoS=2, RETAIN=1
        remainingLength: 8,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [
        0x3d, // PUBLISH type 3, flags 1101
        0x08,
      ]);
    });
  });

  describe("remaining length encoding", () => {
    it("should encode Remaining Length = 127 using one byte", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBLISH,
        flags: 0,
        remainingLength: 127,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [0x30, 0x7f]);
    });

    it("should encode Remaining Length = 128 using two bytes", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBLISH,
        flags: 0,
        remainingLength: 128,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [0x30, 0x80, 0x01]);
    });

    it("should encode Remaining Length = 16383 using two bytes", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBLISH,
        flags: 0,
        remainingLength: 16383,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [0x30, 0xff, 0x7f]);
    });

    it("should encode Remaining Length = 16384 using three bytes", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBLISH,
        flags: 0,
        remainingLength: 16384,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [0x30, 0x80, 0x80, 0x01]);
    });

    it("should encode Remaining Length = 2097151 using three bytes", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBLISH,
        flags: 0,
        remainingLength: 2097151,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [0x30, 0xff, 0xff, 0x7f]);
    });

    it("should encode Remaining Length = 2097152 using four bytes", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBLISH,
        flags: 0,
        remainingLength: 2097152,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [0x30, 0x80, 0x80, 0x80, 0x01]);
    });

    it("should encode maximum Remaining Length = 268435455 using four bytes", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBLISH,
        flags: 0,
        remainingLength: 268435455,
      };

      const result = encodeFixedHeaderV4(fixedHeader);

      expectBytes(result, [0x30, 0xff, 0xff, 0xff, 0x7f]);
    });
  });

  describe("validation", () => {
    it("should throw for invalid packet type 0", () => {
      const fixedHeader: FixedHeader = {
        packetType: 0 as PacketType,
        flags: 0,
        remainingLength: 0,
      };

      expect(() => encodeFixedHeaderV4(fixedHeader)).toThrow();
    });

    it("should throw for invalid packet type 15", () => {
      const fixedHeader: FixedHeader = {
        packetType: 15 as PacketType,
        flags: 0,
        remainingLength: 0,
      };

      expect(() => encodeFixedHeaderV4(fixedHeader)).toThrow();
    });

    it("should throw when PINGREQ has non-zero flags", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PINGREQ,
        flags: 0b0001,
        remainingLength: 0,
      };

      expect(() => encodeFixedHeaderV4(fixedHeader)).toThrow();
    });

    it("should throw when PUBREL has invalid flags", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBREL,
        flags: 0b0000,
        remainingLength: 2,
      };

      expect(() => encodeFixedHeaderV4(fixedHeader)).toThrow();
    });

    it("should throw when SUBSCRIBE has invalid flags", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.SUBSCRIBE,
        flags: 0b0000,
        remainingLength: 8,
      };

      expect(() => encodeFixedHeaderV4(fixedHeader)).toThrow();
    });

    it("should throw when UNSUBSCRIBE has invalid flags", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.UNSUBSCRIBE,
        flags: 0b0000,
        remainingLength: 7,
      };

      expect(() => encodeFixedHeaderV4(fixedHeader)).toThrow();
    });

    // The DUP flag MUST be set to 0 for all QoS 0 messages.
    // [MQTT-3.3.1-2]
    describe("[MQTT-3.3.1-2]", () => {
      it("should throw when PUBLISH has QoS 0 and DUP flag set to 1", () => {
        [
          0b1000, // dup=1, qos=0, retain=0
          0b1001, // dup=1, qos=0, retain=1
        ].forEach((flags) => {
          const fixedHeader: FixedHeader = {
            packetType: PacketType.PUBLISH,
            flags: flags,
            remainingLength: 10,
          };

          expect(() => encodeFixedHeaderV4(fixedHeader)).toThrow(
            /MQTT-3\.3\.1-2/
          );
        });
      });
    });

    // A PUBLISH Packet MUST NOT have both QoS bits set to 1.
    // If a Server or Client receives a PUBLISH Packet which has both QoS bits set to 1 it MUST close the Network Connection.
    // [MQTT-3.3.1-4]
    describe("[MQTT-3.3.1-4]", () => {
      it("should throw when PUBLISH has QoS 3 [MQTT-3.3.1-4]", () => {
        const fixedHeader: FixedHeader = {
          packetType: PacketType.PUBLISH,
          flags: 0b0110, // qos=3 (0b11)
          remainingLength: 5,
        };

        expect(() => encodeFixedHeaderV4(fixedHeader)).toThrow(/MQTT-3\.3\.1-4/);
      });
    });

    it("should throw when Remaining Length is negative", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBLISH,
        flags: 0,
        remainingLength: -1,
      };

      expect(() => encodeFixedHeaderV4(fixedHeader)).toThrow();
    });

    it("should throw when Remaining Length is greater than maximum MQTT value", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBLISH,
        flags: 0,
        remainingLength: 268435456,
      };

      expect(() => encodeFixedHeaderV4(fixedHeader)).toThrow(/Length/);
    });

    it("should throw when Remaining Length is not an integer", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PUBLISH,
        flags: 0,
        remainingLength: 1.5,
      };

      expect(() => encodeFixedHeaderV4(fixedHeader)).toThrow();
    });

    it("should throw when PINGREQ has non-zero Remaining Length", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.PINGREQ,
        flags: 0,
        remainingLength: 1,
      };

      expect(() => encodeFixedHeaderV4(fixedHeader)).toThrow();
    });

    it("should throw when DISCONNECT has non-zero Remaining Length", () => {
      const fixedHeader: FixedHeader = {
        packetType: PacketType.DISCONNECT,
        flags: 0,
        remainingLength: 1,
      };

      expect(() => encodeFixedHeaderV4(fixedHeader)).toThrow();
    });
  });
});
