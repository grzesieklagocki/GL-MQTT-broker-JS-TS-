import { AppError } from "@src/AppError";
import { FixedHeaderValidatorV4 } from "@mqtt/protocol/v4/decoding/parsers/FixedHeaderValidatorV4";
import { PacketType } from "@mqtt/protocol/shared/types";
import { describe, expect, it } from "vitest";

describe("FixedHeaderValidatorV4", () => {
  describe("assertValidPacketType()", () => {
    describe("flow: both", () => {
      const validator = new FixedHeaderValidatorV4("both");

      [
        PacketType.CONNECT,
        PacketType.CONNACK,
        PacketType.PUBLISH,
        PacketType.PUBACK,
        PacketType.PUBREC,
        PacketType.PUBREL,
        PacketType.PUBCOMP,
        PacketType.SUBSCRIBE,
        PacketType.SUBACK,
        PacketType.UNSUBSCRIBE,
        PacketType.UNSUBACK,
        PacketType.PINGREQ,
        PacketType.PINGRESP,
        PacketType.DISCONNECT,
      ].forEach((packetType) => {
        it(`accepts ${PacketType[packetType]} packet type`, () => {
          expect(() =>
            validator.assertValidPacketType(packetType)
          ).not.toThrow();
        });
      });

      [0, 15, -1, 16, 255].forEach((packetType) => {
        it(`rejects unsupported packet type: ${packetType}`, () => {
          expect(() => validator.assertValidPacketType(packetType)).toThrow(
            AppError
          );
        });
      });
    });

    describe("flow: brokerToClient", () => {
      const validator = new FixedHeaderValidatorV4("brokerToClient");

      [
        PacketType.CONNECT,
        PacketType.SUBSCRIBE,
        PacketType.UNSUBSCRIBE,
        PacketType.PINGREQ,
        PacketType.DISCONNECT,
      ].forEach((packetType) => {
        it(`rejects ${PacketType[packetType]} packet type`, () => {
          expect(() => validator.assertValidPacketType(packetType)).toThrow(
            AppError
          );
        });
      });

      [
        PacketType.CONNACK,
        PacketType.PUBLISH,
        PacketType.PUBACK,
        PacketType.PUBREC,
        PacketType.PUBREL,
        PacketType.PUBCOMP,
        PacketType.SUBACK,
        PacketType.UNSUBACK,
        PacketType.PINGRESP,
      ].forEach((packetType) => {
        it(`accepts ${PacketType[packetType]} packet type`, () => {
          expect(() =>
            validator.assertValidPacketType(packetType)
          ).not.toThrow();
        });
      });
    });

    describe("flow: clientToBroker", () => {
      const validator = new FixedHeaderValidatorV4("clientToBroker");

      [
        PacketType.CONNACK,
        PacketType.SUBACK,
        PacketType.UNSUBACK,
        PacketType.PINGRESP,
      ].forEach((packetType) => {
        it(`rejects ${PacketType[packetType]} packet type`, () => {
          expect(() => validator.assertValidPacketType(packetType)).toThrow(
            AppError
          );
        });
      });

      [
        PacketType.CONNECT,
        PacketType.PUBLISH,
        PacketType.PUBACK,
        PacketType.PUBREC,
        PacketType.PUBREL,
        PacketType.PUBCOMP,
        PacketType.SUBSCRIBE,
        PacketType.UNSUBSCRIBE,
        PacketType.PINGREQ,
        PacketType.DISCONNECT,
      ].forEach((packetType) => {
        it(`accepts ${PacketType[packetType]} packet type`, () => {
          expect(() =>
            validator.assertValidPacketType(packetType)
          ).not.toThrow();
        });
      });
    });
  });

  describe("assertValidFlags()", () => {
    const validator = new FixedHeaderValidatorV4();

    describe("reserved flags", () => {
      [
        PacketType.CONNECT,
        PacketType.CONNACK,
        PacketType.PUBACK,
        PacketType.PUBREC,
        PacketType.PUBCOMP,
        PacketType.SUBACK,
        PacketType.UNSUBACK,
        PacketType.PINGREQ,
        PacketType.PINGRESP,
        PacketType.DISCONNECT,
      ].forEach((packetType) => {
        it(`${PacketType[packetType]} accepts flags 0b0000`, () => {
          expect(() =>
            validator.assertValidFlags(packetType, 0b0000)
          ).not.toThrow();
        });

        it(`${PacketType[packetType]} rejects flags other than 0b0000`, () => {
          expect(() => validator.assertValidFlags(packetType, 0b0001)).toThrow(
            AppError
          );
        });
      });

      [PacketType.PUBREL, PacketType.SUBSCRIBE, PacketType.UNSUBSCRIBE].forEach(
        (packetType) => {
          it(`${PacketType[packetType]} accepts flags 0b0010`, () => {
            expect(() =>
              validator.assertValidFlags(packetType, 0b0010)
            ).not.toThrow();
          });

          it(`${PacketType[packetType]} rejects flags other than 0b0010`, () => {
            expect(() =>
              validator.assertValidFlags(packetType, 0b0000)
            ).toThrow(AppError);
          });
        }
      );
    });

    describe("PUBLISH flags", () => {
      [
        0b0000, // DUP=0, QoS=0, RETAIN=0
        0b0001, // DUP=0, QoS=0, RETAIN=1
        0b0010, // DUP=0, QoS=1, RETAIN=0
        0b0011, // DUP=0, QoS=1, RETAIN=1
        0b0100, // DUP=0, QoS=2, RETAIN=0
        0b0101, // DUP=0, QoS=2, RETAIN=1
        0b1010, // DUP=1, QoS=1, RETAIN=0
        0b1011, // DUP=1, QoS=1, RETAIN=1
        0b1100, // DUP=1, QoS=2, RETAIN=0
        0b1101, // DUP=1, QoS=2, RETAIN=1
      ].forEach((flags) => {
        it(`accepts valid PUBLISH flags 0b${flags
          .toString(2)
          .padStart(4, "0")}`, () => {
          expect(() =>
            validator.assertValidFlags(PacketType.PUBLISH, flags)
          ).not.toThrow();
        });
      });

      [
        0b0110, // DUP=0, QoS=3, RETAIN=0
        0b0111, // DUP=0, QoS=3, RETAIN=1
        0b1110, // DUP=1, QoS=3, RETAIN=0
        0b1111, // DUP=1, QoS=3, RETAIN=1
      ].forEach((flags) => {
        it(`rejects PUBLISH flags 0b${flags
          .toString(2)
          .padStart(4, "0")} with QoS 3`, () => {
          expect(() =>
            validator.assertValidFlags(PacketType.PUBLISH, flags)
          ).toThrow(AppError);
        });
      });

      [
        0b1000, // DUP=1, QoS=0, RETAIN=0
        0b1001, // DUP=1, QoS=0, RETAIN=1
      ].forEach((flags) => {
        it(`rejects PUBLISH flags 0b${flags
          .toString(2)
          .padStart(4, "0")} with DUP=1 and QoS=0`, () => {
          expect(() =>
            validator.assertValidFlags(PacketType.PUBLISH, flags)
          ).toThrow(AppError);
        });
      });
    });
  });

  describe("assertValidRemainingLength()", () => {
    const validator = new FixedHeaderValidatorV4();

    describe("packets with Remaining Length equal to 0", () => {
      [PacketType.PINGREQ, PacketType.PINGRESP, PacketType.DISCONNECT].forEach(
        (packetType) => {
          it(`${PacketType[packetType]} accepts Remaining Length equal to 0`, () => {
            expect(() =>
              validator.assertValidRemainingLength(packetType, 0)
            ).not.toThrow();
          });

          it(`${PacketType[packetType]} rejects Remaining Length greater than 0`, () => {
            expect(() =>
              validator.assertValidRemainingLength(packetType, 1)
            ).toThrow(/Length/);
          });
        }
      );
    });

    describe("packets with Remaining Length equal to 2", () => {
      [
        PacketType.CONNACK,
        PacketType.PUBACK,
        PacketType.PUBREC,
        PacketType.PUBREL,
        PacketType.PUBCOMP,
        PacketType.UNSUBACK,
      ].forEach((packetType) => {
        it(`${PacketType[packetType]} accepts Remaining Length equal to 2`, () => {
          expect(() =>
            validator.assertValidRemainingLength(packetType, 2)
          ).not.toThrow();
        });

        it(`${PacketType[packetType]} rejects Remaining Length below 2`, () => {
          expect(() =>
            validator.assertValidRemainingLength(packetType, 1)
          ).toThrow(/Length/);
        });

        it(`${PacketType[packetType]} rejects Remaining Length above 2`, () => {
          expect(() =>
            validator.assertValidRemainingLength(packetType, 3)
          ).toThrow(/Length/);
        });
      });
    });

    describe("packets with minimum Remaining Length", () => {
      [
        [PacketType.SUBACK, 3],
        [PacketType.PUBLISH, 3],
        [PacketType.UNSUBSCRIBE, 5],
        [PacketType.SUBSCRIBE, 6],
        [PacketType.CONNECT, 12],
      ].forEach(([packetType, minimumRemainingLength]) => {
        it(`${PacketType[packetType]} accepts minimum Remaining Length equal to ${minimumRemainingLength}`, () => {
          expect(() =>
            validator.assertValidRemainingLength(
              packetType,
              minimumRemainingLength
            )
          ).not.toThrow();
        });

        it(`${PacketType[packetType]} rejects Remaining Length below ${minimumRemainingLength}`, () => {
          expect(() =>
            validator.assertValidRemainingLength(
              packetType,
              minimumRemainingLength - 1
            )
          ).toThrow(/Length/);
        });

        it(`${PacketType[packetType]} accepts Remaining Length above ${minimumRemainingLength}`, () => {
          expect(() =>
            validator.assertValidRemainingLength(
              packetType,
              minimumRemainingLength + 1
            )
          ).not.toThrow();
        });
      });
    });

    describe("Remaining Length range", () => {
      it("accepts maximum Remaining Length", () => {
        expect(() =>
          validator.assertValidRemainingLength(PacketType.PUBLISH, 0x0fff_ffff)
        ).not.toThrow(/Length/);
      });

      it("rejects Remaining Length greater than 0x0FFFFFFF", () => {
        expect(() =>
          validator.assertValidRemainingLength(PacketType.PUBLISH, 0x1000_0000)
        ).toThrow(/Length/);
      });

      it("rejects negative Remaining Length", () => {
        expect(() =>
          validator.assertValidRemainingLength(PacketType.PUBLISH, -1)
        ).toThrow(/Length/);
      });
    });
  });
});
