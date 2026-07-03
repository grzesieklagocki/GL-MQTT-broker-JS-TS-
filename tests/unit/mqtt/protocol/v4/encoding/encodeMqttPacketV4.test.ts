import { describe, expect, it } from "vitest";
import { encodeMqttPacketV4 } from "@mqtt/protocol/v4/encoding/encodeMqttPacketV4";
import {
  MqttPacketV4Factory,
  Will,
} from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { PacketType } from "@mqtt/protocol/shared/types";
import {
  ConnackReturnCodeV4,
  PublishFlagsV4,
  SubackReturnCodeV4,
  SubscriptionV4,
} from "@mqtt/protocol/v4/types";

describe("encodeMqttPacketV4", () => {
  describe("simple packets", () => {
    it("should encode PINGREQ", () => {
      const packet = MqttPacketV4Factory.createSimplePacketV4(
        PacketType.PINGREQ
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0xc0, // PINGREQ, flags 0000
        0x00, // Remaining Length
      ]);
    });

    it("should encode PINGRESP", () => {
      const packet = MqttPacketV4Factory.createSimplePacketV4(
        PacketType.PINGRESP
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0xd0, // PINGRESP, flags 0000
        0x00,
      ]);
    });

    it("should encode DISCONNECT", () => {
      const packet = MqttPacketV4Factory.createSimplePacketV4(
        PacketType.DISCONNECT
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0xe0, // DISCONNECT, flags 0000
        0x00,
      ]);
    });
  });

  describe("packets with identifier", () => {
    it("should encode PUBACK", () => {
      const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.PUBACK,
        0x1234
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0x40, // PUBACK
        0x02, // Remaining Length
        0x12,
        0x34,
      ]);
    });

    it("should encode PUBREC", () => {
      const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.PUBREC,
        0x1234
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0x50, // PUBREC
        0x02,
        0x12,
        0x34,
      ]);
    });

    it("should encode PUBREL with required flags 0010", () => {
      const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.PUBREL,
        0x1234
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0x62, // PUBREL, flags 0010
        0x02,
        0x12,
        0x34,
      ]);
    });

    it("should encode PUBCOMP", () => {
      const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.PUBCOMP,
        0x1234
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0x70, // PUBCOMP
        0x02,
        0x12,
        0x34,
      ]);
    });

    it("should encode UNSUBACK", () => {
      const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.UNSUBACK,
        0x1234
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0xb0, // UNSUBACK
        0x02,
        0x12,
        0x34,
      ]);
    });
  });

  describe("CONNECT", () => {
    it("should encode minimal CONNECT packet", () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true, // cleanSession
        60, // keepAlive
        "" // zero-byte client identifier
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0x10, // CONNECT
        0x0c, // Remaining Length = 12

        // Protocol Name: "MQTT"
        0x00,
        0x04,
        0x4d,
        0x51,
        0x54,
        0x54,

        // Protocol Level
        0x04,

        // Connect Flags: Clean Session
        0b00000010,

        // Keep Alive = 60
        0x00,
        0x3c,

        // Client Identifier: ""
        0x00,
        0x00,
      ]);
    });

    it("should encode CONNECT packet with will, username and password", () => {
      const will: Will = {
        topic: "/",
        message: new Uint8Array([0xfc]),
        qos: 1,
        retain: false,
      };

      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true, // cleanSession
        220, // keepAlive
        "id", // clientIdentifier
        "user", // userName
        new Uint8Array([0xbb]), // password
        will
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0x10, // CONNECT
        0x1d, // Remaining Length = 29

        // Protocol Name: "MQTT"
        0x00,
        0x04,
        0x4d,
        0x51,
        0x54,
        0x54,

        // Protocol Level
        0x04,

        // Connect Flags:
        // username=1, password=1, willRetain=0, willQoS=01,
        // willFlag=1, cleanSession=1, reserved=0
        0b11001110,

        // Keep Alive = 220
        0x00,
        0xdc,

        // Client Identifier: "id"
        0x00,
        0x02,
        0x69,
        0x64,

        // Will Topic: "/"
        0x00,
        0x01,
        0x2f,

        // Will Message
        0x00,
        0x01,
        0xfc,

        // User Name: "user"
        0x00,
        0x04,
        0x75,
        0x73,
        0x65,
        0x72,

        // Password
        0x00,
        0x01,
        0xbb,
      ]);
    });
  });

  describe("CONNACK", () => {
    it("should encode CONNACK with session present false", () => {
      const packet = MqttPacketV4Factory.createConnackPacketV4(
        false,
        ConnackReturnCodeV4.CONNECTION_ACCEPTED
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0x20, // CONNACK
        0x02, // Remaining Length
        0x00, // Acknowledge Flags
        0x00, // Return Code: accepted
      ]);
    });

    it("should encode CONNACK with session present true", () => {
      const packet = MqttPacketV4Factory.createConnackPacketV4(
        true,
        ConnackReturnCodeV4.CONNECTION_ACCEPTED
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0x20,
        0x02,
        0x01, // Session Present
        0x00,
      ]);
    });
  });

  describe("PUBLISH", () => {
    it("should encode QoS 0 PUBLISH without packet identifier", () => {
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

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0x30, // PUBLISH, DUP=0, QoS=0, RETAIN=0
        0x05, // Remaining Length = topic length(2+1) + payload(2)

        // Topic Name: "a"
        0x00,
        0x01,
        0x61,

        // Application Message
        0x10,
        0x20,
      ]);
    });

    it("should encode QoS 1 PUBLISH with packet identifier", () => {
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

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0x32, // PUBLISH, QoS=1
        0x07, // topic(3) + identifier(2) + payload(2)

        // Topic Name: "a"
        0x00,
        0x01,
        0x61,

        // Packet Identifier
        0x12,
        0x34,

        // Application Message
        0x10,
        0x20,
      ]);
    });

    it("should encode QoS 2 PUBLISH with DUP and RETAIN flags", () => {
      const flags: PublishFlagsV4 = {
        dup: true,
        qosLevel: 2,
        retain: true,
      };

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        new Uint8Array([0xaa]),
        flags,
        "t/a",
        0x0001
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0b0011_1101, // PUBLISH, DUP=1, QoS=2, RETAIN=1
        0x08, // topic(2+3) + identifier(2) + payload(1)

        // Topic Name: "t/a"
        0x00,
        0x03,
        0x74,
        0x2f,
        0x61,

        // Packet Identifier
        0x00,
        0x01,

        // Application Message
        0xaa,
      ]);
    });

    it("should encode PUBLISH with empty payload", () => {
      const flags: PublishFlagsV4 = {
        dup: false,
        qosLevel: 0,
        retain: true,
      };

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        new Uint8Array([]),
        flags,
        "a"
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0x31, // PUBLISH, RETAIN=1
        0x03, // topic only

        // Topic Name: "a"
        0x00,
        0x01,
        0x61,
      ]);
    });
  });

  describe("SUBSCRIBE", () => {
    it("should encode SUBSCRIBE with one subscription", () => {
      const subscriptions: SubscriptionV4[] = [["a/b", 1]];

      const packet = MqttPacketV4Factory.createSubscribePacketV4(
        0x1234,
        subscriptions
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0x82, // SUBSCRIBE, required flags 0010
        0x08, // identifier(2) + topic filter(2+3) + QoS(1)

        // Packet Identifier
        0x12,
        0x34,

        // Topic Filter: "a/b"
        0x00,
        0x03,
        0x61,
        0x2f,
        0x62,

        // Requested QoS
        0x01,
      ]);
    });

    it("should encode SUBSCRIBE with multiple subscriptions", () => {
      const subscriptions: SubscriptionV4[] = [
        ["a/b", 0],
        ["c/#", 2],
      ];

      const packet = MqttPacketV4Factory.createSubscribePacketV4(
        0x0001,
        subscriptions
      );

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0x82,
        0x0e, // identifier(2) + first(6) + second(6)

        // Packet Identifier
        0x00,
        0x01,

        // Topic Filter: "a/b"
        0x00,
        0x03,
        0x61,
        0x2f,
        0x62,
        0x00,

        // Topic Filter: "c/#"
        0x00,
        0x03,
        0x63,
        0x2f,
        0x23,
        0x02,
      ]);
    });
  });

  describe("SUBACK", () => {
    it("should encode SUBACK with multiple return codes", () => {
      const packet = MqttPacketV4Factory.createSubackPacketV4(0x1234, [
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_2,
        SubackReturnCodeV4.FAILURE,
      ]);

      const result = encodeMqttPacketV4(packet);

      expect([...result]).toEqual([
        0x90, // SUBACK
        0x06, // identifier(2) + four return codes(4)
        0x12,
        0x34,
        0x00,
        0x01,
        0x02,
        0x80,
      ]);
    });
  });

  describe("UNSUBSCRIBE", () => {
    it("should encode UNSUBSCRIBE with one topic filter", () => {
      const packet = MqttPacketV4Factory.createUnsubscribePacketV4(0x1234, [
        "a/b",
      ]);

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0xa2, // UNSUBSCRIBE, required flags 0010
        0x07, // identifier(2) + topic filter(2+3)

        // Packet Identifier
        0x12,
        0x34,

        // Topic Filter: "a/b"
        0x00,
        0x03,
        0x61,
        0x2f,
        0x62,
      ]);
    });

    it("should encode UNSUBSCRIBE with multiple topic filters", () => {
      const packet = MqttPacketV4Factory.createUnsubscribePacketV4(0x0001, [
        "a/b",
        "c/#",
      ]);

      const result = encodeMqttPacketV4(packet);

      expectBytes(result, [
        0xa2,
        0x0c, // identifier(2) + first(5) + second(5)

        // Packet Identifier
        0x00,
        0x01,

        // Topic Filter: "a/b"
        0x00,
        0x03,
        0x61,
        0x2f,
        0x62,

        // Topic Filter: "c/#"
        0x00,
        0x03,
        0x63,
        0x2f,
        0x23,
      ]);
    });
  });

  describe("Remaining Length", () => {
    it("should encode Remaining Length using multiple bytes when packet body is 128 bytes", () => {
      const flags: PublishFlagsV4 = {
        dup: false,
        qosLevel: 0,
        retain: false,
      };

      // Topic length = 2 + 1 = 3
      // Payload length = 125
      // Remaining Length = 128
      const payload = new Uint8Array(125).fill(0xaa);

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        payload,
        flags,
        "a"
      );

      const result = encodeMqttPacketV4(packet);

      expect(result[0]).toBe(0x30);
      expect(result[1]).toBe(0x80);
      expect(result[2]).toBe(0x01);
      expect(result).toHaveLength(3 + 128);
    });
  });
});

//
// test helpers
//

// expect that the actual bytes of Uint8Array are equal to the expected bytes
function expectBytes(actual: Uint8Array, expected: number[]): void {
  expect([...actual]).toEqual(expected);
}
