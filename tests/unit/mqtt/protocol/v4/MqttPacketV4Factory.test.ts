import { describe, expect, it } from "vitest";
import { PacketType } from "@mqtt/protocol/shared/types";
import {
  MqttPacketV4Factory,
  PacketWithIdentifierV4Type,
  SimplePacketV4Type,
} from "@src/mqtt/protocol/v4/MqttPacketV4Factory";
import {
  ConnackReturnCodeV4,
  ConnectFlagsV4,
  ConnectionPayloadV4,
  PublishFlagsV4,
  SubackReturnCodeV4,
  SubscriptionV4,
} from "@mqtt/protocol/v4/types";

describe("MqttPacketV4Factory", () => {
  describe("createSimplePacketV4", () => {
    [PacketType.PINGREQ, PacketType.PINGRESP, PacketType.DISCONNECT].forEach(
      (packetType) => {
        it(`should create ${PacketType[packetType]} packet`, () => {
          const packet = MqttPacketV4Factory.createSimplePacketV4(
            packetType as SimplePacketV4Type
          );

          expect(packet).toEqual({
            typeId: packetType,
          });
        });
      }
    );
  });

  describe("createPacketWithIdentifierV4", () => {
    [
      PacketType.PUBACK,
      PacketType.PUBREC,
      PacketType.PUBREL,
      PacketType.PUBCOMP,
      PacketType.UNSUBACK,
    ].forEach((packetType) => {
      it(`should create ${PacketType[packetType]} packet`, () => {
        const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
          packetType as PacketWithIdentifierV4Type,
          123
        );

        expect(packet).toEqual({
          typeId: packetType,
          identifier: 123,
        });
      });
    });
  });

  describe("createConnectPacketV4", () => {
    it("should create CONNECT packet", () => {
      const flags: ConnectFlagsV4 = {
        userName: true,
        password: true,
        willRetain: false,
        willQoS: 1,
        willFlag: true,
        cleanSession: true,
      };

      const payload: ConnectionPayloadV4 = {
        clientIdentifier: "client-1",
        willTopic: "status/client-1",
        willMessage: new Uint8Array([0x6f, 0x66, 0x66]),
        userName: "user",
        password: new Uint8Array([0x01, 0x02, 0x03]),
      };

      const packet = MqttPacketV4Factory.createConnectPacketV4(
        flags,
        60,
        payload
      );

      expect(packet).toEqual({
        typeId: PacketType.CONNECT,
        protocol: {
          name: "MQTT",
          level: 4,
        },
        flags,
        keepAlive: 60,
        payload,
      });
    });

    it("should preserve payload", () => {
      const flags: ConnectFlagsV4 = {
        userName: false,
        password: false,
        willRetain: false,
        willQoS: 0,
        willFlag: false,
        cleanSession: true,
      };

      const payload: ConnectionPayloadV4 = {
        clientIdentifier: "client-1",
      };

      const packet = MqttPacketV4Factory.createConnectPacketV4(
        flags,
        30,
        payload
      );

      expect(packet.payload).toBe(payload);
    });

    it("should preserve flags", () => {
      const flags: ConnectFlagsV4 = {
        userName: false,
        password: false,
        willRetain: false,
        willQoS: 0,
        willFlag: false,
        cleanSession: true,
      };

      const payload: ConnectionPayloadV4 = {
        clientIdentifier: "client-1",
      };

      const packet = MqttPacketV4Factory.createConnectPacketV4(
        flags,
        30,
        payload
      );

      expect(packet.flags).toBe(flags);
    });
  });

  describe("createConnackPacketV4", () => {
    it("should create CONNACK packet with session present flag set to true", () => {
      const packet = MqttPacketV4Factory.createConnackPacketV4(
        true,
        ConnackReturnCodeV4.CONNECTION_ACCEPTED
      );

      expect(packet).toEqual({
        typeId: PacketType.CONNACK,
        sessionPresentFlag: true,
        connectReturnCode: ConnackReturnCodeV4.CONNECTION_ACCEPTED,
      });
    });

    it("should create CONNACK packet with session present flag set to false", () => {
      const packet = MqttPacketV4Factory.createConnackPacketV4(
        false,
        ConnackReturnCodeV4.CONNECTION_REFUSED_BAD_USER_NAME_OR_PASSWORD
      );

      expect(packet).toEqual({
        typeId: PacketType.CONNACK,
        sessionPresentFlag: false,
        connectReturnCode:
          ConnackReturnCodeV4.CONNECTION_REFUSED_BAD_USER_NAME_OR_PASSWORD,
      });
    });
  });

  describe("createPublishPacketV4", () => {
    it("should create PUBLISH packet without identifier", () => {
      const applicationMessage = new Uint8Array([0x01, 0x02, 0x03]);

      const flags: PublishFlagsV4 = {
        dup: false,
        qosLevel: 0,
        retain: false,
      };

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        applicationMessage,
        flags,
        "test/topic"
      );

      expect(packet).toEqual({
        typeId: PacketType.PUBLISH,
        flags,
        identifier: undefined,
        topicName: "test/topic",
        applicationMessage,
      });
    });

    it("should create PUBLISH packet with identifier", () => {
      const applicationMessage = new Uint8Array([0xaa, 0xbb]);

      const flags: PublishFlagsV4 = {
        dup: false,
        qosLevel: 1,
        retain: true,
      };

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        applicationMessage,
        flags,
        "sensors/temperature",
        42
      );

      expect(packet).toEqual({
        typeId: PacketType.PUBLISH,
        flags,
        identifier: 42,
        topicName: "sensors/temperature",
        applicationMessage,
      });
    });

    it("should preserve application message reference", () => {
      const applicationMessage = new Uint8Array([0x10, 0x20]);

      const flags: PublishFlagsV4 = {
        dup: false,
        qosLevel: 0,
        retain: false,
      };

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        applicationMessage,
        flags,
        "test/topic"
      );

      expect(packet.applicationMessage).toBe(applicationMessage);
    });

    it("should preserve flags reference", () => {
      const applicationMessage = new Uint8Array([0x10, 0x20]);

      const flags: PublishFlagsV4 = {
        dup: true,
        qosLevel: 2,
        retain: true,
      };

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        applicationMessage,
        flags,
        "test/topic",
        10
      );

      expect(packet.flags).toBe(flags);
    });
  });

  describe("createSubscribePacketV4", () => {
    it("should create SUBSCRIBE packet", () => {
      const subscriptionList: SubscriptionV4[] = [
        ["sensors/+/temperature", 0],
        ["home/#", 1],
      ];

      const packet = MqttPacketV4Factory.createSubscribePacketV4(
        15,
        subscriptionList
      );

      expect(packet).toEqual({
        typeId: PacketType.SUBSCRIBE,
        identifier: 15,
        subscriptionList,
      });
    });

    it("should preserve subscription list reference", () => {
      const subscriptionList: SubscriptionV4[] = [["a/b", 1]];

      const packet = MqttPacketV4Factory.createSubscribePacketV4(
        1,
        subscriptionList
      );

      expect(packet.subscriptionList).toBe(subscriptionList);
    });

    it("should allow empty subscription list at factory level", () => {
      const packet = MqttPacketV4Factory.createSubscribePacketV4(1, []);

      expect(packet).toEqual({
        typeId: PacketType.SUBSCRIBE,
        identifier: 1,
        subscriptionList: [],
      });
    });
  });

  describe("createSubackPacketV4", () => {
    it.each([
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
      SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_2,
      SubackReturnCodeV4.FAILURE,
    ])("should create SUBACK packet with return code %s", (returnCode) => {
      const packet = MqttPacketV4Factory.createSubackPacketV4(99, returnCode);

      expect(packet).toEqual({
        typeId: PacketType.SUBACK,
        identifier: 99,
        returnCode,
      });
    });
  });

  describe("createUnsubscribePacketV4", () => {
    it("should create UNSUBSCRIBE packet", () => {
      const topicFilterList = ["sensors/+", "home/#"];

      const packet = MqttPacketV4Factory.createUnsubscribePacketV4(
        7,
        topicFilterList
      );

      expect(packet).toEqual({
        typeId: PacketType.UNSUBSCRIBE,
        identifier: 7,
        topicFilterList,
      });
    });

    it("should preserve topic filter list reference", () => {
      const topicFilterList = ["a/b", "c/d"];

      const packet = MqttPacketV4Factory.createUnsubscribePacketV4(
        7,
        topicFilterList
      );

      expect(packet.topicFilterList).toBe(topicFilterList);
    });
  });
});
