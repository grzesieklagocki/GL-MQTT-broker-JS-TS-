import { describe, expect, it } from "vitest";
import { PacketType } from "@mqtt/protocol/shared/types";
import {
  MqttPacketV4Factory,
  PacketWithIdentifierV4Type,
  SimplePacketV4Type,
  Will,
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
  describe("createSimplePacketV4()", () => {
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

  describe("createPacketWithIdentifierV4()", () => {
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

  describe("createConnectPacketV4()", () => {
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

      const will: Will = {
        topic: payload.willTopic as string,
        message: payload.willMessage as Uint8Array,
        qos: flags.willQoS,
        retain: false,
      };

      const keepAlive = 60;

      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true, // cleanSession
        keepAlive, // keepAlive
        payload.clientIdentifier, // clientIdentifier
        payload.userName as string, // userName
        payload.password as Uint8Array, // password
        will
      );

      expect(packet).toEqual({
        typeId: PacketType.CONNECT,
        protocol: {
          name: "MQTT",
          level: 4,
        },
        flags,
        keepAlive: keepAlive,
        payload,
      });
    });

    it("should create CONNECT packet with undefined optional fields", () => {
      const flags: ConnectFlagsV4 = {
        userName: false,
        password: false,
        willRetain: false,
        willQoS: 0,
        willFlag: false,
        cleanSession: false,
      };

      const payload: ConnectionPayloadV4 = {
        clientIdentifier: "client-2",
      };

      const keepAlive = 30;

      const packet = MqttPacketV4Factory.createConnectPacketV4(
        false, // cleanSession
        keepAlive, // keepAlive
        payload.clientIdentifier // clientIdentifier
      );

      expect(packet).toEqual({
        typeId: PacketType.CONNECT,
        protocol: {
          name: "MQTT",
          level: 4,
        },
        flags,
        keepAlive: keepAlive,
        payload,
      });
    });
    // should correctly set flags

    it("should correctly set flags based on provided parameters", () => {
      const will: Will = {
        topic: "status/client-3",
        message: new Uint8Array([0x01, 0x02]),
        qos: 2,
        retain: true,
      };

      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true, // cleanSession
        120, // keepAlive
        "client-3", // clientIdentifier
        "user3", // userName
        new Uint8Array([0xaa, 0xbb]), // password
        will
      );

      expect(packet.flags).toEqual({
        userName: true,
        password: true,
        willRetain: true,
        willQoS: 2,
        willFlag: true,
        cleanSession: true,
      });
    });
  });

  describe("createConnackPacketV4()", () => {
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

  describe("createPublishPacketV4()", () => {
    it("should create PUBLISH packet without identifier", () => {
      const topic = "test/topic";
      const applicationMessage = new Uint8Array([0x01, 0x02, 0x03]);
      const flags: PublishFlagsV4 = MqttPacketV4Factory.createPublishFlagsV4(); // default flags (qos 0, retain false, dup false)

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        topic,
        applicationMessage
      );

      expect(packet).toEqual({
        typeId: PacketType.PUBLISH,
        flags,
        identifier: undefined,
        topicName: topic,
        applicationMessage,
      });
    });

    it("should create PUBLISH packet with identifier", () => {
      const topic = "sensors/temperature";
      const applicationMessage = new Uint8Array([0xaa, 0xbb]);
      const flags: PublishFlagsV4 = MqttPacketV4Factory.createPublishFlagsV4(
        1, // qos
        true // retain
      );
      const identifier = 42;

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        topic,
        applicationMessage,
        flags,
        identifier
      );

      expect(packet).toEqual({
        typeId: PacketType.PUBLISH,
        flags,
        identifier: identifier,
        topicName: topic,
        applicationMessage,
      });
    });

    it("should preserve application message reference", () => {
      const applicationMessage = new Uint8Array([0x10, 0x20]);

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        "test/topic", // topic
        applicationMessage
      );

      expect(packet.applicationMessage).toBe(applicationMessage);
    });

    it("should preserve flags reference", () => {
      const applicationMessage = new Uint8Array([0x10, 0x20]);

      const flags: PublishFlagsV4 = MqttPacketV4Factory.createPublishFlagsV4(
        2, // qos
        true, // retain
        true // dup
      );

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        "test/topic",
        applicationMessage,
        flags,
        10
      );

      expect(packet.flags).toBe(flags);
    });
  });

  describe("createSubscribePacketV4()", () => {
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
  });

  describe("createSubackPacketV4()", () => {
    it("should create SUBACK packet with a single return code", () => {
      const packet = MqttPacketV4Factory.createSubackPacketV4(99, [
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
      ]);

      expect(packet).toEqual({
        typeId: PacketType.SUBACK,
        identifier: 99,
        returnCodeList: [SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1],
      });
    });

    it("should create SUBACK packet with multiple return codes", () => {
      const returnCodeList = [
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_2,
        SubackReturnCodeV4.FAILURE,
      ];

      const packet = MqttPacketV4Factory.createSubackPacketV4(
        99,
        returnCodeList
      );

      expect(packet).toEqual({
        typeId: PacketType.SUBACK,
        identifier: 99,
        returnCodeList,
      });
    });

    it("should preserve return codes array reference", () => {
      const returnCodeList = [
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
        SubackReturnCodeV4.FAILURE,
      ];

      const packet = MqttPacketV4Factory.createSubackPacketV4(
        99,
        returnCodeList
      );

      expect(packet.returnCodeList).toBe(returnCodeList);
    });
  });

  describe("createUnsubscribePacketV4()", () => {
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

  describe("createConnectWillV4()", () => {
    it("should create Will with required topic and default values", () => {
      const will = MqttPacketV4Factory.createConnectWillV4("status/device-1");

      expect(will).toEqual({
        topic: "status/device-1",
        message: undefined,
        qos: 0,
        retain: false,
      });
    });

    it("should create Will with topic and message", () => {
      const message = new Uint8Array([0x6f, 0x66, 0x66]); // "off"

      const will = MqttPacketV4Factory.createConnectWillV4(
        "status/device-1",
        message
      );

      expect(will).toEqual({
        topic: "status/device-1",
        message,
        qos: 0,
        retain: false,
      });
    });

    it("should create Will with QoS 1", () => {
      const message = new Uint8Array([0x01]);

      const will = MqttPacketV4Factory.createConnectWillV4(
        "status/device-1",
        message,
        1
      );

      expect(will).toEqual({
        topic: "status/device-1",
        message,
        qos: 1,
        retain: false,
      });
    });

    it("should create Will with QoS 2", () => {
      const message = new Uint8Array([0x01]);

      const will = MqttPacketV4Factory.createConnectWillV4(
        "status/device-1",
        message,
        2
      );

      expect(will).toEqual({
        topic: "status/device-1",
        message,
        qos: 2,
        retain: false,
      });
    });

    it("should create Will with retain flag set", () => {
      const message = new Uint8Array([0x01]);

      const will = MqttPacketV4Factory.createConnectWillV4(
        "status/device-1",
        message,
        0,
        true
      );

      expect(will).toEqual({
        topic: "status/device-1",
        message,
        qos: 0,
        retain: true,
      });
    });

    it("should create Will with all optional values set", () => {
      const message = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

      const will = MqttPacketV4Factory.createConnectWillV4(
        "status/device-1",
        message,
        2,
        true
      );

      expect(will).toEqual({
        topic: "status/device-1",
        message,
        qos: 2,
        retain: true,
      });
    });

    it("should preserve message reference", () => {
      const message = new Uint8Array([0x01, 0x02, 0x03]);

      const will = MqttPacketV4Factory.createConnectWillV4(
        "status/device-1",
        message,
        1,
        true
      );

      expect(will.message).toBe(message);
    });

    it("should allow empty message", () => {
      const message = new Uint8Array([]);

      const will = MqttPacketV4Factory.createConnectWillV4(
        "status/device-1",
        message
      );

      expect(will).toEqual({
        topic: "status/device-1",
        message,
        qos: 0,
        retain: false,
      });
    });

    it.each([
      { qos: 0, retain: false },
      { qos: 0, retain: true },
      { qos: 1, retain: false },
      { qos: 1, retain: true },
      { qos: 2, retain: false },
      { qos: 2, retain: true },
    ] as const)(
      "should create Will for qos=$qos retain=$retain",
      ({ qos, retain }) => {
        const message = new Uint8Array([0x01]);

        const will = MqttPacketV4Factory.createConnectWillV4(
          "status/device-1",
          message,
          qos,
          retain
        );

        expect(will).toEqual({
          topic: "status/device-1",
          message,
          qos,
          retain,
        });
      }
    );
  });

  describe("createPublishFlagsV4()", () => {
    it("should create default PUBLISH flags", () => {
      const flags = MqttPacketV4Factory.createPublishFlagsV4();

      expect(flags).toEqual({
        qosLevel: 0,
        retain: false,
        dup: false,
      });
    });

    it("should create PUBLISH flags with QoS 0", () => {
      const flags = MqttPacketV4Factory.createPublishFlagsV4(0);

      expect(flags).toEqual({
        qosLevel: 0,
        retain: false,
        dup: false,
      });
    });

    it("should create PUBLISH flags with QoS 1", () => {
      const flags = MqttPacketV4Factory.createPublishFlagsV4(1);

      expect(flags).toEqual({
        qosLevel: 1,
        retain: false,
        dup: false,
      });
    });

    it("should create PUBLISH flags with QoS 2", () => {
      const flags = MqttPacketV4Factory.createPublishFlagsV4(2);

      expect(flags).toEqual({
        qosLevel: 2,
        retain: false,
        dup: false,
      });
    });

    it("should create PUBLISH flags with retain flag true", () => {
      const flags = MqttPacketV4Factory.createPublishFlagsV4(0, true);

      expect(flags).toEqual({
        qosLevel: 0,
        retain: true,
        dup: false,
      });
    });

    it("should create PUBLISH flags with dup flag true", () => {
      const flags = MqttPacketV4Factory.createPublishFlagsV4(0, false, true);

      expect(flags).toEqual({
        qosLevel: 0,
        retain: false,
        dup: true,
      });
    });

    it("should create PUBLISH flags with QoS, retain and dup true", () => {
      const flags = MqttPacketV4Factory.createPublishFlagsV4(2, true, true);

      expect(flags).toEqual({
        qosLevel: 2,
        retain: true,
        dup: true,
      });
    });

    it.each([
      { qos: 0, retain: false, dup: false },
      { qos: 0, retain: false, dup: true },
      { qos: 0, retain: true, dup: false },
      { qos: 0, retain: true, dup: true },

      { qos: 1, retain: false, dup: false },
      { qos: 1, retain: false, dup: true },
      { qos: 1, retain: true, dup: false },
      { qos: 1, retain: true, dup: true },

      { qos: 2, retain: false, dup: false },
      { qos: 2, retain: false, dup: true },
      { qos: 2, retain: true, dup: false },
      { qos: 2, retain: true, dup: true },
    ] as const)(
      "should create PUBLISH flags for qos=$qos retain=$retain dup=$dup",
      ({ qos, retain, dup }) => {
        const flags = MqttPacketV4Factory.createPublishFlagsV4(
          qos,
          retain,
          dup
        );

        expect(flags).toEqual({
          qosLevel: qos,
          retain,
          dup,
        });
      }
    );
  });
});
