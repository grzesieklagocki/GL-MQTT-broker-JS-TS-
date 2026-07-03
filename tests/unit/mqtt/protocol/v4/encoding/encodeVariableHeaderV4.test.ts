import { describe, expect, it } from "vitest";
import { PacketType } from "@mqtt/protocol/shared/types";
import {
  MqttPacketV4Factory,
  PacketWithIdentifierV4Type,
  SimplePacketV4Type,
} from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { encodeVariableHeaderV4 } from "@src/mqtt/protocol/v4/encoding/encodeVariableHeaderV4";
import {
  ConnackReturnCodeV4,
  ConnectFlagsV4,
  ConnectionPayloadV4,
  PublishFlagsV4,
  SubackReturnCodeV4,
  SubscriptionV4,
} from "@mqtt/protocol/v4/types";

const expectBytes = (actual: Uint8Array, expected: number[]) => {
  expect([...actual]).toEqual(expected);
};

describe("encodeVariableHeaderV4", () => {
  describe("simple packets", () => {
    [PacketType.PINGREQ, PacketType.PINGRESP, PacketType.DISCONNECT].forEach(
      (packetType) => {
        it(`should encode empty variable header for ${PacketType[packetType]}`, () => {
          const packet = MqttPacketV4Factory.createSimplePacketV4(
            packetType as SimplePacketV4Type
          );

          const result = encodeVariableHeaderV4(packet);

          expectBytes(result, []);
        });
      }
    );
  });

  describe("packets with identifier", () => {
    [
      PacketType.PUBACK,
      PacketType.PUBREC,
      PacketType.PUBREL,
      PacketType.PUBCOMP,
      PacketType.UNSUBACK,
    ].forEach((packetType) => {
      it(`should encode packet identifier for ${PacketType[packetType]}`, () => {
        const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
          packetType as PacketWithIdentifierV4Type,
          0x7641
        );

        const result = encodeVariableHeaderV4(packet);

        expectBytes(result, [0x76, 0x41]);
      });
    });

    it("should encode packet identifier 0x0000", () => {
      const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.PUBACK,
        0
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(result, [0x00, 0x00]);
    });

    it("should encode packet identifier 0xa3c9", () => {
      const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.PUBACK,
        0xa3c9
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(result, [0xa3, 0xc9]);
    });

    it("should encode maximum packet identifier 0xffff", () => {
      const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.PUBACK,
        0xffff
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(result, [0xff, 0xff]);
    });
  });

  describe("CONNECT", () => {
    it("should encode minimal CONNECT variable header", () => {
      const flags: ConnectFlagsV4 = {
        userName: false,
        password: false,
        willRetain: false,
        willQoS: 0,
        willFlag: false,
        cleanSession: true,
      };

      const payload: ConnectionPayloadV4 = {
        clientIdentifier: "id",
      };

      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true, // cleanSession
        60, // keepAlive
        "id"
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(
        result,
        [
          // Protocol Name: "MQTT"
          0x00, 0x04, 0x4d, 0x51, 0x54, 0x54,

          // Protocol Level
          0x04,

          // Connect Flags: Clean Session
          0b00000010,

          // Keep Alive = 60
          0x00, 0x3c,
        ]
      );
    });

    it("should encode CONNECT variable header with will, username and password flags", () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true,
        220,
        "id",
        "user",
        new Uint8Array([0xbb])
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(
        result,
        [
          // Protocol Name: "MQTT"
          0x00, 0x04, 0x4d, 0x51, 0x54, 0x54,

          // Protocol Level
          0x04,

          // Connect Flags:
          // username=1, password=1, willRetain=0, willQoS=00,
          // willFlag=0, cleanSession=1, reserved=0
          0b11000010,

          // Keep Alive = 220
          0x00, 0xdc,
        ]
      );
    });

    it("should encode CONNECT variable header with clean session false", () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        false, // cleanSession
        30, // keepAlive
        "persistent-client" // clientIdentifier
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(
        result,
        [0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0b00000000, 0x00, 0x1e]
      );
    });

    it("should encode CONNECT variable header with keep alive 0", () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true, // cleanSession
        0, // keepAlive
        "id" // clientIdentifier
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(
        result,
        [0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0b00000010, 0x00, 0x00]
      );
    });

    it("should encode CONNECT variable header with maximum keep alive", () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true, // cleanSession
        0xffff, // keepAlive
        "id" // clientIdentifier
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(
        result,
        [0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0b00000010, 0xff, 0xff]
      );
    });
  });

  describe("CONNACK", () => {
    it("should encode CONNACK variable header with session present false", () => {
      const packet = MqttPacketV4Factory.createConnackPacketV4(
        false,
        ConnackReturnCodeV4.CONNECTION_ACCEPTED
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(result, [
        0x00, // Acknowledge Flags
        0x00, // Return Code
      ]);
    });

    it("should encode CONNACK variable header with session present true", () => {
      const packet = MqttPacketV4Factory.createConnackPacketV4(
        true,
        ConnackReturnCodeV4.CONNECTION_ACCEPTED
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(result, [
        0x01, // Session Present
        0x00,
      ]);
    });

    it("should encode CONNACK variable header with refused return code", () => {
      const packet = MqttPacketV4Factory.createConnackPacketV4(
        false,
        ConnackReturnCodeV4.CONNECTION_REFUSED_BAD_USER_NAME_OR_PASSWORD
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(result, [
        0x00,
        ConnackReturnCodeV4.CONNECTION_REFUSED_BAD_USER_NAME_OR_PASSWORD,
      ]);
    });
  });

  describe("PUBLISH", () => {
    it("should encode PUBLISH variable header for QoS 0 without identifier", () => {
      const flags: PublishFlagsV4 = {
        dup: false,
        qosLevel: 0,
        retain: false,
      };

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        new Uint8Array([0x10, 0x20]),
        flags,
        "a"
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(
        result,
        [
          // Topic Name: "a"
          0x00, 0x01, 0x61,
        ]
      );
    });

    it("should encode PUBLISH variable header for QoS 1 with identifier", () => {
      const flags: PublishFlagsV4 = {
        dup: false,
        qosLevel: 1,
        retain: false,
      };

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        new Uint8Array([0x10, 0x20]),
        flags,
        "a",
        0x1234
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(
        result,
        [
          // Topic Name: "a"
          0x00, 0x01, 0x61,

          // Packet Identifier
          0x12, 0x34,
        ]
      );
    });

    it("should encode PUBLISH variable header for QoS 2 with identifier", () => {
      const flags: PublishFlagsV4 = {
        dup: false,
        qosLevel: 2,
        retain: false,
      };

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        new Uint8Array([0xaa]),
        flags,
        "t/a",
        0x0001
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(
        result,
        [
          // Topic Name: "t/a"
          0x00, 0x03, 0x74, 0x2f, 0x61,

          // Packet Identifier
          0x00, 0x01,
        ]
      );
    });

    it("should encode UTF-8 topic name", () => {
      const flags: PublishFlagsV4 = {
        dup: false,
        qosLevel: 0,
        retain: false,
      };

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        new Uint8Array([]),
        flags,
        "ąć"
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(
        result,
        [
          // "ąć" UTF-8: C4 85 C4 87, length = 4 bytes
          0x00, 0x04, 0xc4, 0x85, 0xc4, 0x87,
        ]
      );
    });
  });

  describe("SUBSCRIBE", () => {
    it("should encode SUBSCRIBE variable header", () => {
      const subscriptions: SubscriptionV4[] = [["a/b", 1]];

      const packet = MqttPacketV4Factory.createSubscribePacketV4(
        0x1234,
        subscriptions
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(result, [0x12, 0x34]);
    });
  });

  describe("SUBACK", () => {
    it("should encode SUBACK variable header", () => {
      const packet = MqttPacketV4Factory.createSubackPacketV4(0x1234, [
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_2,
        SubackReturnCodeV4.FAILURE,
      ]);

      const result = encodeVariableHeaderV4(packet);

      expectBytes(result, [0x12, 0x34]);
    });
  });

  describe("UNSUBSCRIBE", () => {
    it("should encode UNSUBSCRIBE variable header", () => {
      const packet = MqttPacketV4Factory.createUnsubscribePacketV4(0x1234, [
        "a/b",
        "c/#",
      ]);

      const result = encodeVariableHeaderV4(packet);

      expectBytes(result, [0x12, 0x34]);
    });
  });
});
