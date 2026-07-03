import { describe, expect, it } from "vitest";
import { PacketType } from "@mqtt/protocol/shared/types";
import {
  MqttPacketV4Factory,
  SimplePacketV4Type,
  Will,
} from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { encodePayloadV4 } from "@mqtt/protocol/v4/encoding/encodePayloadV4";
import {
  ConnectFlagsV4,
  ConnectionPayloadV4,
  PublishFlagsV4,
  SubackReturnCodeV4,
  SubscriptionV4,
} from "@mqtt/protocol/v4/types";

const expectBytes = (actual: Uint8Array, expected: number[]) => {
  expect([...actual]).toEqual(expected);
};

describe("encodePayloadV4", () => {
  describe("packets without payload", () => {
    [
      PacketType.CONNACK,
      PacketType.PUBACK,
      PacketType.PUBREC,
      PacketType.PUBREL,
      PacketType.PUBCOMP,
      PacketType.UNSUBACK,
      PacketType.PINGREQ,
      PacketType.PINGRESP,
      PacketType.DISCONNECT,
    ].forEach((packetType) =>
      it(`should encode empty payload for ${PacketType[packetType]}`, () => {
        let packet;

        if (
          packetType === PacketType.PUBACK ||
          packetType === PacketType.PUBREC ||
          packetType === PacketType.PUBREL ||
          packetType === PacketType.PUBCOMP ||
          packetType === PacketType.UNSUBACK
        ) {
          packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
            packetType,
            0x1234
          );
        } else if (packetType === PacketType.CONNACK) {
          packet = MqttPacketV4Factory.createConnackPacketV4(false, 0);
        } else {
          packet = MqttPacketV4Factory.createSimplePacketV4(
            packetType as SimplePacketV4Type
          );
        }

        const result = encodePayloadV4(packet);

        expectBytes(result, []);
      })
    );
  });

  describe("CONNECT", () => {
    it("should encode CONNECT payload with only Client Identifier", () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true, // cleanSession
        60, // keepAlive
        "id" // clientIdentifier
      );

      const result = encodePayloadV4(packet);

      expectBytes(
        result,
        [
          // Client Identifier: "id"
          0x00, 0x02, 0x69, 0x64,
        ]
      );
    });

    it("should encode CONNECT payload with Client Identifier and Will fields", () => {
      const will: Will = {
        topic: "status",
        message: new Uint8Array([0x6f, 0x66, 0x66]), // "off"
        qos: 1,
        retain: false,
      };

      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true, // cleanSession
        60, // keepAlive
        "id", // clientIdentifier
        undefined, // userName
        undefined, // password
        will
      );

      const result = encodePayloadV4(packet);

      expectBytes(
        result,
        [
          // Client Identifier: "id"
          0x00, 0x02, 0x69, 0x64,

          // Will Topic: "status"
          0x00, 0x06, 0x73, 0x74, 0x61, 0x74, 0x75, 0x73,

          // Will Message: [0x6f, 0x66, 0x66]
          0x00, 0x03, 0x6f, 0x66, 0x66,
        ]
      );
    });

    it("should encode CONNECT payload with User Name", () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true, // cleanSession
        60, // keepAlive
        "id", // clientIdentifier
        "user" // userName
      );

      const result = encodePayloadV4(packet);

      expectBytes(
        result,
        [
          // Client Identifier: "id"
          0x00, 0x02, 0x69, 0x64,

          // User Name: "user"
          0x00, 0x04, 0x75, 0x73, 0x65, 0x72,
        ]
      );
    });

    it("should encode CONNECT payload with User Name and Password", () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true, // cleanSession
        60, // keepAlive
        "id", // clientIdentifier
        "user", // userName
        new Uint8Array([0xbb]) // password
      );

      const result = encodePayloadV4(packet);

      expectBytes(
        result,
        [
          // Client Identifier: "id"
          0x00, 0x02, 0x69, 0x64,

          // User Name: "user"
          0x00, 0x04, 0x75, 0x73, 0x65, 0x72,

          // Password
          0x00, 0x01, 0xbb,
        ]
      );
    });

    it("should encode CONNECT payload with Will, User Name and Password in correct order", () => {
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

      const result = encodePayloadV4(packet);

      expectBytes(
        result,
        [
          // Client Identifier: "id"
          0x00, 0x02, 0x69, 0x64,

          // Will Topic: "/"
          0x00, 0x01, 0x2f,

          // Will Message
          0x00, 0x01, 0xfc,

          // User Name: "user"
          0x00, 0x04, 0x75, 0x73, 0x65, 0x72,

          // Password
          0x00, 0x01, 0xbb,
        ]
      );
    });

    it("should encode UTF-8 Client Identifier with polish letters", () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true, // cleanSession
        220, // keepAlive
        "ąć" // clientIdentifier
      );

      const result = encodePayloadV4(packet);

      expectBytes(
        result,
        [
          // "ąć" UTF-8 = C4 85 C4 87, length = 4 bytes
          0x00, 0x04, 0xc4, 0x85, 0xc4, 0x87,
        ]
      );
    });
  });

  describe("PUBLISH", () => {
    it("should encode PUBLISH payload with application message", () => {
      const flags: PublishFlagsV4 = {
        dup: false,
        qosLevel: 0,
        retain: false,
      };

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        new Uint8Array([0x10, 0x20, 0x30]),
        flags,
        "a"
      );

      const result = encodePayloadV4(packet);

      expectBytes(result, [0x10, 0x20, 0x30]);
    });

    it("should encode empty PUBLISH payload", () => {
      const flags: PublishFlagsV4 = {
        dup: false,
        qosLevel: 0,
        retain: false,
      };

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        new Uint8Array([]),
        flags,
        "a"
      );

      const result = encodePayloadV4(packet);

      expectBytes(result, []);
    });

    it("should preserve binary PUBLISH payload bytes", () => {
      const flags: PublishFlagsV4 = {
        dup: false,
        qosLevel: 1,
        retain: false,
      };

      const packet = MqttPacketV4Factory.createPublishPacketV4(
        new Uint8Array([0x00, 0xff, 0x80, 0x7f]),
        flags,
        "binary",
        0x1234
      );

      const result = encodePayloadV4(packet);

      expectBytes(result, [0x00, 0xff, 0x80, 0x7f]);
    });
  });

  describe("SUBSCRIBE", () => {
    it("should encode SUBSCRIBE payload with one subscription", () => {
      const subscriptions: SubscriptionV4[] = [["a/b", 1]];

      const packet = MqttPacketV4Factory.createSubscribePacketV4(
        0x1234,
        subscriptions
      );

      const result = encodePayloadV4(packet);

      expectBytes(
        result,
        [
          // Topic Filter: "a/b"
          0x00, 0x03, 0x61, 0x2f, 0x62,

          // Requested QoS
          0x01,
        ]
      );
    });

    it("should encode SUBSCRIBE payload with multiple subscriptions", () => {
      const subscriptions: SubscriptionV4[] = [
        ["a/b", 0],
        ["c/#", 2],
      ];

      const packet = MqttPacketV4Factory.createSubscribePacketV4(
        0x0001,
        subscriptions
      );

      const result = encodePayloadV4(packet);

      expectBytes(
        result,
        [
          // Topic Filter: "a/b"
          0x00, 0x03, 0x61, 0x2f, 0x62, 0x00,

          // Topic Filter: "c/#"
          0x00, 0x03, 0x63, 0x2f, 0x23, 0x02,
        ]
      );
    });

    it("should encode SUBSCRIBE payload with UTF-8 topic filter", () => {
      const subscriptions: SubscriptionV4[] = [["dom/ąć", 1]];

      const packet = MqttPacketV4Factory.createSubscribePacketV4(
        0x0001,
        subscriptions
      );

      const result = encodePayloadV4(packet);

      expectBytes(
        result,
        [
          // "dom/ąć"
          // d o m / = 4 bytes
          // ą ć = 4 bytes
          // total = 8 bytes
          0x00, 0x08, 0x64, 0x6f, 0x6d, 0x2f, 0xc4, 0x85, 0xc4, 0x87,

          // Requested QoS
          0x01,
        ]
      );
    });

    // The Topic Filters in a SUBSCRIBE packet payload MUST be UTF-8 encoded strings as defined in Section 1.5.3.
    // [MQTT-3.8.3-1]
    it("should throw AppError for SUBSCRIBE packet with empty topic filter", () => {
      [[""], ["topic", ""]].forEach((topics) => {
        const packet = MqttPacketV4Factory.createSubscribePacketV4(
          0x0001, // identifier
          topics.map((topic) => [topic, 0])
        );

        expect(() => encodePayloadV4(packet)).toThrow(/MQTT-3\.8\.3-1/);
      });
    });

    // [MQTT-3.8.3-3]
    // The payload of a SUBSCRIBE packet MUST contain at least one Topic Filter / QoS pair. A SUBSCRIBE packet with no payload is a protocol violation.
    it("should throw AppError for SUBSCRIBE packet with no subscriptions", () => {
      const packet = MqttPacketV4Factory.createSubscribePacketV4(
        0x0001, // identifier
        [] // no subscriptions
      );

      expect(() => encodePayloadV4(packet)).toThrow(/MQTT-3\.8\.3-3/);
    });
  });

  describe("SUBACK", () => {
    it("should encode SUBACK payload with one return code", () => {
      const packet = MqttPacketV4Factory.createSubackPacketV4(0x1234, [
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
      ]);

      const result = encodePayloadV4(packet);

      expectBytes(result, [0x01]);
    });

    it("should encode SUBACK payload with multiple return codes", () => {
      const packet = MqttPacketV4Factory.createSubackPacketV4(0x1234, [
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
        SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_2,
        SubackReturnCodeV4.FAILURE,
      ]);

      const result = encodePayloadV4(packet);

      expectBytes(result, [0x00, 0x01, 0x02, 0x80]);
    });

    it("should encode empty SUBACK payload when returnCodes is empty", () => {
      const packet = MqttPacketV4Factory.createSubackPacketV4(0x1234, []);

      const result = encodePayloadV4(packet);

      expectBytes(result, []);
    });

    // SUBACK return codes other than 0x00, 0x01, 0x02 and 0x80 are reserved and MUST NOT be used.
    // [MQTT-3.9.3-2]
    it("should throw if SUBACK packet has invalid return code [MQTT-3.9.3-2]", () => {
      [
        [0x03],
        [0x0c, 0x13],
        [0x02, 0x81, 0x01],
        [0x01, 0x01, 0x02, 0x79],
        [0x00, 0x02, 0x01, 0xff, 0x00],
      ].forEach((returnCodeList) => {
        const packet = MqttPacketV4Factory.createSubackPacketV4(
          0x1234,
          returnCodeList
        );

        expect(() => encodePayloadV4(packet)).toThrow(/MQTT-3\.9\.3-2/);
      });
    });
  });

  describe("UNSUBSCRIBE", () => {
    it("should encode UNSUBSCRIBE payload with one topic filter", () => {
      const packet = MqttPacketV4Factory.createUnsubscribePacketV4(0x1234, [
        "a/b",
      ]);

      const result = encodePayloadV4(packet);

      expectBytes(
        result,
        [
          // Topic Filter: "a/b"
          0x00, 0x03, 0x61, 0x2f, 0x62,
        ]
      );
    });

    it("should encode UNSUBSCRIBE payload with multiple topic filters", () => {
      const packet = MqttPacketV4Factory.createUnsubscribePacketV4(0x0001, [
        "a/b",
        "c/#",
      ]);

      const result = encodePayloadV4(packet);

      expectBytes(
        result,
        [
          // Topic Filter: "a/b"
          0x00, 0x03, 0x61, 0x2f, 0x62,

          // Topic Filter: "c/#"
          0x00, 0x03, 0x63, 0x2f, 0x23,
        ]
      );
    });

    it("should encode UNSUBSCRIBE payload with topic filter with polish letters", () => {
      const packet = MqttPacketV4Factory.createUnsubscribePacketV4(0x0001, [
        "dom/ąć",
      ]);

      const result = encodePayloadV4(packet);

      expectBytes(
        result,
        [
          // "dom/ąć" = 8 UTF-8 bytes
          0x00, 0x08, 0x64, 0x6f, 0x6d, 0x2f, 0xc4, 0x85, 0xc4, 0x87,
        ]
      );
    });
  });
});
