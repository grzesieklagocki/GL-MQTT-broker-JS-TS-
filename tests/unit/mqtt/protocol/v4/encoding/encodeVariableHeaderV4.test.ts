import { describe, expect, it } from "vitest";
import { PacketType, QoS } from "@mqtt/protocol/shared/types";
import {
  MqttPacketV4Factory,
  PacketWithIdentifierV4Type,
  SimplePacketV4Type,
  Will,
} from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { encodeVariableHeaderV4 } from "@mqtt/protocol/v4/encoding/encodeVariableHeaderV4";
import {
  ConnackReturnCodeV4,
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

    it("should encode packet identifier 0x0001", () => {
      const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.PUBACK,
        0x0001
      );

      const result = encodeVariableHeaderV4(packet);

      expectBytes(result, [0x00, 0x01]);
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

    // SUBSCRIBE, UNSUBSCRIBE, and PUBLISH (in cases where QoS > 0) Control Packets MUST contain a non-zero 16-bit Packet Identifier.
    // [MQTT-2.3.1-1]
    it("should throw if packet identifier is 0 [MQTT-2.3.1-1]", () => {
      const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.PUBACK,
        0x0000
      );

      expect(() => encodeVariableHeaderV4(packet)).toThrow(/MQTT-2\.3\.1-1/);
    });

    it("should throw if packet identifier is negative", () => {
      const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.PUBACK,
        -1
      );

      expect(() => encodeVariableHeaderV4(packet)).toThrow(/unsigned/);
    });

    it("should throw if packet identifier is greater than 0xffff (2-bytes)", () => {
      const packet = MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.PUBACK,
        0xffff + 1
      );

      expect(() => encodeVariableHeaderV4(packet)).toThrow(/16-bit/);
    });
  });

  describe("CONNECT", () => {
    it("should encode minimal CONNECT variable header", () => {
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

    // If the protocol name is incorrect the Server MAY disconnect the Client,
    // or it MAY continue processing the CONNECT packet in accordance with some other specification.
    // In the latter case, the Server MUST NOT continue to process the CONNECT packet in line with this specification.
    // [MQTT-3.1.2-1]
    describe("[MQTT-3.1.2-1]", () => {
      it("should throw if CONNECT packet has invalid protocol name", () => {
        const packet = MqttPacketV4Factory.createConnectPacketV4(
          true,
          20,
          "id_1"
        );

        // invalid protocol levels for MQTT 3.1.1
        [0, 1, 2, 3, 5, 0x0b, 0xc1, 0xff].forEach((invalidLevel) => {
          packet.protocol.level = invalidLevel as 4;

          expect(() => encodeVariableHeaderV4(packet)).toThrow(
            /MQTT-3\.1\.2-1/
          );
        });
      });
    });

    // The Server MUST validate that the reserved flag in the CONNECT Control Packet is set to zero
    // and disconnect the Client if it is not zero.
    // [MQTT-3.1.2-3]
    describe("[MQTT-3.1.2-3]", () => {
      it("Is it not possible to set the reserved flag in the CONNECT packet encoder, so we can skip this test", () => {});
    });

    // If the Will Flag is set to 1, the Will QoS and Will Retain fields in the Connect Flags will be used by the Server,
    // and the Will Topic and Will Message fields MUST be present in the payload.
    // [MQTT-3.1.2-9]
    describe("[MQTT-3.1.2-9]", () => {
      [
        {
          topic: "willTopic",
          messsage: undefined,
          reason: "no will topic",
        },
        {
          topic: undefined,
          messsage: new Uint8Array([0x00, 0x01, 0x50]),
          reason: "no will message",
        },
        {
          topic: undefined,
          messsage: undefined,
          reason: "no will topic and message",
        },
      ].forEach((testCase) => {
        it(`should throw if CONNECT packet has willFlag true but ${testCase.reason}`, () => {
          const packet = MqttPacketV4Factory.createConnectPacketV4(
            true, // cleanSession
            120, // keepAlive
            "clientID", // clientIdentifier
            undefined, // username
            undefined, // password
            {
              topic: testCase.topic as string,
              message: testCase.messsage,
              qos: 0,
              retain: false,
            } satisfies Will
          );

          expect(packet.flags.willFlag).toBe(true);
          expect(() => encodeVariableHeaderV4(packet)).toThrow(
            /MQTT-3\.1\.2-9/
          );
        });
      });
    });

    // If the Will Flag is set to 0 the Will QoS and Will Retain fields in the Connect Flags MUST be set to zero
    // and the Will Topic and Will Message fields MUST NOT be present in the payload.
    // [MQTT-3.1.2-11]
    describe("[MQTT-3.1.2-11]", () => {
      it("should throw if CONNECT packet has willFlag false but will qos is non-zero", () => {
        [1, 2].forEach((qos) => {
          const packet = MqttPacketV4Factory.createConnectPacketV4(
            true, // cleanSession
            120, // keepAlive
            "clientID" // clientIdentifier
          );

          packet.flags.willFlag = false;
          packet.flags.willQoS = qos as QoS;

          expect(() => encodeVariableHeaderV4(packet)).toThrow(
            /MQTT-3\.1\.2-11/
          );
        });
      });

      it("should throw if CONNECT packet has willFlag false but will qos is non-zero", () => {
        const packet = MqttPacketV4Factory.createConnectPacketV4(
          true, // cleanSession
          120, // keepAlive
          "clientID" // clientIdentifier
        );

        packet.flags.willFlag = false;
        packet.flags.willRetain = true;

        expect(() => encodeVariableHeaderV4(packet)).toThrow(/MQTT-3\.1\.2-11/);
      });
    });

    // If the Will Flag is set to 0, then the Will QoS MUST be set to 0 (0x00).
    // [MQTT-3.1.2-13]
    describe("[MQTT-3.1.2-13]", () => {
      [1, 2].forEach((qos) => {
        it(`should throw if CONNECT packet has willFlag false but will qos is ${qos}`, () => {
          const packet = MqttPacketV4Factory.createConnectPacketV4(
            false, // cleanSession
            0, // keepAlive
            "client1" // clientIdentifier
          );

          packet.flags.willFlag = false;
          packet.flags.willQoS = qos as QoS;

          expect(() => encodeVariableHeaderV4(packet)).toThrow(
            /MQTT-3\.1\.2-13/
          );
        });
      });
    });

    // If the Will Flag is set to 1, the value of Will QoS can be 0 (0x00), 1 (0x01), or 2 (0x02).
    // It MUST NOT be 3 (0x03).
    // [MQTT-3.1.2-14]
    describe("[MQTT-3.1.2-14]", () => {
      it("should throw if CONNECT packet has willFlag true but will qos is 3 (0b11)", () => {
        const packet = MqttPacketV4Factory.createConnectPacketV4(
          true, // cleanSession
          5, // keepAlive
          "client2", // clientIdentifier
          undefined, // username
          undefined, // password
          MqttPacketV4Factory.createConnectWillV4(
            "topic", // will topic
            new Uint8Array() // will message
          )
        );

        packet.flags.willQoS = 3 as QoS;

        expect(packet.flags.willFlag).toBe(true);
        expect(() => encodeVariableHeaderV4(packet)).toThrow(/MQTT-3\.1\.2-14/);
      });
    });

    // If the Will Flag is set to 0, then the Will Retain Flag MUST be set to 0.
    // [MQTT-3.1.2-15]
    describe("[MQTT-3.1.2-15]", () => {
      it("should throw if CONNECT packet has willFlag false but will retain is true", () => {
        const packet = MqttPacketV4Factory.createConnectPacketV4(
          true, // cleanSession
          51, // keepAlive
          "client3" // clientIdentifier
        );

        packet.flags.willFlag = false;
        packet.flags.willRetain = true;

        expect(() => encodeVariableHeaderV4(packet)).toThrow(/MQTT-3\.1\.2-15/);
      });
    });

    // If the User Name Flag is set to 0, a user name MUST NOT be present in the payload.
    // [MQTT-3.1.2-18]
    describe("[MQTT-3.1.2-18]", () => {
      it("should throw if CONNECT packet has userNameFlag false but userName present", () => {
        const packet = MqttPacketV4Factory.createConnectPacketV4(
          true, // cleanSession
          120, // keepAlive
          "clientID", // clientIdentifier
          "user" // username
        );

        packet.flags.userName = false;

        expect(packet.payload.userName).toBeDefined();
        expect(() => encodeVariableHeaderV4(packet)).toThrow(/MQTT-3\.1\.2-18/);
      });
    });

    // If the User Name Flag is set to 1, a user name MUST be present in the payload.
    // [MQTT-3.1.2-19]
    describe("[MQTT-3.1.2-19]", () => {
      it("should throw if CONNECT packet has userNameFlag true but userName not present", () => {
        const packet = MqttPacketV4Factory.createConnectPacketV4(
          true, // cleanSession
          120, // keepAlive
          "clientID", // clientIdentifier
          undefined // no username
        );

        packet.flags.userName = true;

        expect(packet.payload.userName).not.toBeDefined();
        expect(() => encodeVariableHeaderV4(packet)).toThrow(/MQTT-3\.1\.2-19/);
      });
    });

    // If the Password Flag is set to 0, a password MUST NOT be present in the payload.
    // [MQTT-3.1.2-20]
    describe("[MQTT-3.1.2-20]", () => {
      it("should throw if CONNECT packet has passwordFlag false but password present", () => {
        const packet = MqttPacketV4Factory.createConnectPacketV4(
          true, // cleanSession
          120, // keepAlive
          "clientID", // clientIdentifier
          undefined, // no username
          new Uint8Array([0x87]) // password
        );

        packet.flags.password = false;

        expect(packet.payload.password).toBeDefined();
        expect(() => encodeVariableHeaderV4(packet)).toThrow(/MQTT-3\.1\.2-20/);
      });
    });

    // If the Password Flag is set to 1, a password MUST be present in the payload.
    // [MQTT-3.1.2-21]
    describe("[MQTT-3.1.2-21]", () => {
      it("should throw if CONNECT packet has passwordFlag true but password not present", () => {
        const packet = MqttPacketV4Factory.createConnectPacketV4(
          true, // cleanSession
          120, // keepAlive
          "clientID", // clientIdentifier
          "", // username
          undefined // password
        );

        packet.flags.password = true;

        expect(packet.payload.password).not.toBeDefined();
        expect(() => encodeVariableHeaderV4(packet)).toThrow(/MQTT-3\.1\.2-21/);
      });
    });

    // If the User Name Flag is set to 0, the Password Flag MUST be set to 0.
    // [MQTT-3.1.2-22]
    describe("[MQTT-3.1.2-22]", () => {
      it("should throw if CONNECT packet has userNameFlag false but passwordFlag true", () => {
        const packet = MqttPacketV4Factory.createConnectPacketV4(
          true, // cleanSession
          120, // keepAlive
          "clientID", // clientIdentifier
          undefined, // no username
          new Uint8Array([0x99, 0x7c]) // password
        );

        expect(packet.flags.userName).toBe(false);
        expect(packet.flags.password).toBe(true);
        expect(() => encodeVariableHeaderV4(packet)).toThrow(/MQTT-3\.1\.2-22/);
      });
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
      const packet = MqttPacketV4Factory.createPublishPacketV4(
        "a", // topic
        new Uint8Array([0x10, 0x20]) // message
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
      const packet = MqttPacketV4Factory.createPublishPacketV4(
        "a", // topic
        new Uint8Array([0x10, 0x20]), // message
        MqttPacketV4Factory.createPublishFlagsV4(1), // qos 1
        0x1234 // identifier
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
      const packet = MqttPacketV4Factory.createPublishPacketV4(
        "t/a", // topic
        new Uint8Array([0xaa]), // message
        MqttPacketV4Factory.createPublishFlagsV4(2), // qos 2
        0x0001 // identifier
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
      const packet = MqttPacketV4Factory.createPublishPacketV4(
        "ąć" // topic
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

    // A PUBLISH Packet MUST NOT contain a Packet Identifier if its QoS value is set to 0.
    // [MQTT-2.3.1-5]
    describe("[MQTT-2.3.1-5]", () => {
      it("should throw if PUBLISH packet has QoS 0 and identifier", () => {
        const packet = MqttPacketV4Factory.createPublishPacketV4(
          "topic",
          undefined, // message
          MqttPacketV4Factory.createPublishFlagsV4(), // default flags, qos 0
          0xdd
        );

        expect(() => encodeVariableHeaderV4(packet)).toThrow(/MQTT-2\.3\.1-5/);
      });
    });

    // The Topic Name MUST be present as the first field in the PUBLISH Packet Variable header.
    // It MUST be a UTF-8 encoded string.
    // [MQTT-3.3.2-1]
    describe("[MQTT-3.3.2-1]", () => {
      it("should encode Topic Name as UTF-8 encoded string", () => {
        const packet = MqttPacketV4Factory.createPublishPacketV4(
          "topic/GŁ" // topic
        );

        const result = encodeVariableHeaderV4(packet);

        expectBytes(
          result,
          [
            // Topin Name length: 9
            0x00, 0x09,
            // Topic Name: "topic/GŁ" (UTF‑8)
            0x74, 0x6f, 0x70, 0x69, 0x63, 0x2f, 0x47, 0xc5, 0x81,
          ]
        );
      });

      it("should throw if PUBLISH packet has topic name that are not string", () => {
        [21, true, false, undefined, null].forEach((topic) => {
          const packet = MqttPacketV4Factory.createPublishPacketV4(
            topic as unknown as string
          );

          expect(() => encodeVariableHeaderV4(packet)).toThrow(
            /MQTT-3\.3\.2-1/
          );
        });
      });
    });

    // The Topic Name in the PUBLISH Packet MUST NOT contain wildcard characters.
    // [MQTT-3.3.2-2]
    describe("[MQTT-3.3.2-2]", () => {
      it("should throw if PUBLISH packet has topic name with wildcard", () => {
        ["+", "#", "a/+/b", "c/#"].forEach((topic) => {
          const packet = MqttPacketV4Factory.createPublishPacketV4(topic);

          expect(() => encodeVariableHeaderV4(packet)).toThrow(
            /MQTT-3\.3\.2-2/
          );
        });
      });
    });

    // All Topic Names and Topic Filters MUST be at least one character long.
    // [MQTT-4.7.3-1]
    describe("[MQTT-4.7.3-1]", () => {
      it("should throw if PUBLISH packet has empty topic name", () => {
        [[""], ["topic", ""]].forEach((topics) => {
          const packet = MqttPacketV4Factory.createPublishPacketV4(
            "" // topic
          );

          expect(() => encodeVariableHeaderV4(packet)).toThrow(
            /MQTT-4\.7\.3-1/
          );
        });
      });
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
