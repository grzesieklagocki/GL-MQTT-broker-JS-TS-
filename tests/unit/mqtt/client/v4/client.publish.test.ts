import { PacketType, QoS } from "@mqtt/protocol/shared/types";
import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMqttClientV4TestContext } from "./createMqttClientV4TestContext";

describe("MqttClientV4", () => {
  describe("PUBLISH", () => {
    let testContext: ReturnType<typeof createMqttClientV4TestContext>;

    const topic = "a/b";
    const message = new Uint8Array([0x00, 0x03, 0x6d, 0x73, 0x67]);

    const publishFlags = (qos: QoS = 0) =>
      MqttPacketV4Factory.createPublishFlagsV4(qos);

    const publishPacket = (identifier: number | undefined, qos: QoS = 0) =>
      MqttPacketV4Factory.createPublishPacketV4(
        topic,
        message,
        publishFlags(qos),
        identifier
      );

    const pubackPacket = (identifier = 1) =>
      MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.PUBACK,
        identifier
      );

    const expectPublishSent = (
      identifier: number | undefined,
      qos: QoS = 0
    ) => {
      expect(testContext.transportMock.send).toHaveBeenCalledExactlyOnceWith(
        publishPacket(identifier, qos)
      );
    };

    beforeEach(async () => {
      testContext = createMqttClientV4TestContext();
      await testContext.connectClientAndClearSendMock();
    });

    beforeAll(() => {
      vi.useFakeTimers();
    });

    describe("QoS 0", () => {
      it("sends PUBLISH without packet identifier and resolves without waiting for PUBACK", async () => {
        await expect(
          testContext.client.publish(topic, message)
        ).resolves.toBeUndefined();

        expectPublishSent(undefined, 0);
      });
    });

    describe("QoS 1", () => {
      it("sends PUBLISH with packet identifier and resolves when matching PUBACK is received", async () => {
        testContext.transportMock.send.mockImplementationOnce(() => {
          testContext.sendBack(pubackPacket(1));
        });

        await expect(
          testContext.client.publish(topic, message, publishFlags(1))
        ).resolves.toBeUndefined();

        expectPublishSent(1, 1);
      });

      it("rejects when PUBACK is not received before timeout", async () => {
        const promise = testContext.client.publish(
          topic,
          message,
          publishFlags(1)
        );
        const assertion = expect(promise).rejects.toThrow(/timeout/);

        await vi.advanceTimersByTimeAsync(10_000);

        await assertion;

        expectPublishSent(1, 1);
      });

      it("ignores PUBACK with different packet identifier and rejects after timeout", async () => {
        testContext.transportMock.send.mockImplementationOnce(() => {
          testContext.sendBack(pubackPacket(55));
        });

        const promise = testContext.client.publish(
          topic,
          message,
          publishFlags(1)
        );
        const assertion = expect(promise).rejects.toThrow(/timeout/);

        await vi.advanceTimersByTimeAsync(10_000);

        await assertion;

        expectPublishSent(1, 1);
      });

      it("keeps waiting for PUBACK after receiving a different ACK with the same identifier", async () => {
        testContext.transportMock.send.mockImplementationOnce(() => {
          testContext.sendBack(
            MqttPacketV4Factory.createPacketWithIdentifierV4(
              PacketType.UNSUBACK,
              1
            )
          );
        });

        const promise = testContext.client.publish(
          topic,
          message,
          publishFlags(1)
        );
        testContext.sendBack(pubackPacket(1));

        await expect(promise).resolves.toBeUndefined();

        expectPublishSent(1, 1);
      });
    });

    describe("QoS 2", () => {
      // MQTT 3.1.1 section 4.3.3 [MQTT-4.3.3-1].
      it("sends PUBREL after PUBREC and completes the publish only after matching PUBCOMP", async () => {
        const { client, managerMock, sendBack, transportMock } = testContext;
        const onResolved = vi.fn();
        const onRejected = vi.fn();
        const ack = MqttPacketV4Factory.createPacketWithIdentifierV4;

        const completion = client
          .publish(topic, message, publishFlags(/* qos */ 2))
          .then(onResolved, onRejected);
        await vi.advanceTimersByTimeAsync(0);

        expectPublishSent(/* id */ 1, /* qos */ 2);
        expect(onResolved).not.toHaveBeenCalled();
        expect(onRejected).not.toHaveBeenCalled();
        expect(managerMock.releaseIdentifier).not.toHaveBeenCalled();

        sendBack(ack(PacketType.PUBREC, /* id */ 1));
        await vi.advanceTimersByTimeAsync(0);

        expect(transportMock.send.mock.calls).toEqual([
          [publishPacket(/* id */ 1, /* qos */ 2)],
          [ack(PacketType.PUBREL, /* id */ 1)],
        ]);

        sendBack(ack(PacketType.PUBCOMP, /* id */ 2));
        await vi.advanceTimersByTimeAsync(0);

        expect(onResolved).not.toHaveBeenCalled();
        expect(onRejected).not.toHaveBeenCalled();
        expect(managerMock.releaseIdentifier).not.toHaveBeenCalled();

        sendBack(ack(PacketType.PUBCOMP, /* id */ 1));
        await vi.advanceTimersByTimeAsync(0);

        expect(onResolved).toHaveBeenCalledExactlyOnceWith(undefined);
        expect(onRejected).not.toHaveBeenCalled();
        expect(managerMock.releaseIdentifier).toHaveBeenCalledExactlyOnceWith(
          /* id */ 1
        );
        await completion;
      });
    });

    it("sends nothing when received PUBLISH packet with QOS 0", () => {
      const packet = MqttPacketV4Factory.createPublishPacketV4("topic");

      expect(packet.typeId).toBe(PacketType.PUBLISH);
      expect(packet.flags.qosLevel).toBe(0);

      testContext.sendBack(packet); // simulate receiving a PUBLISH packet

      vi.waitFor(() => {
        expect(testContext.transportMock.send).not.toBeCalled();
      });
    });

    [1, 0xa1, 0xff].forEach((packetId) => {
      it(`sends PUBACK packet with same packet identifier (${packetId}) when received PUBLISH packet with QOS 1`, () => {
        const flags = MqttPacketV4Factory.createPublishFlagsV4(1); // qos: 1
        const packet = MqttPacketV4Factory.createPublishPacketV4(
          topic,
          message,
          flags,
          packetId // packet identifier
        );

        expect(packet.typeId).toBe(PacketType.PUBLISH);
        expect(packet.flags.qosLevel).toBe(1);

        testContext.sendBack(packet); // simulate receiving a PUBLISH packet by client

        vi.waitFor(() => {
          expect(
            testContext.transportMock.send
          ).toHaveBeenCalledExactlyOnceWith(
            MqttPacketV4Factory.createPacketWithIdentifierV4(
              PacketType.PUBACK,
              packetId
            )
          );
        });
      });
    });

    [
      // qos: 0
      MqttPacketV4Factory.createPublishPacketV4(topic, message),

      // qos: 1
      MqttPacketV4Factory.createPublishPacketV4(
        topic,
        message,
        MqttPacketV4Factory.createPublishFlagsV4(1),
        0xffff
      ),

      // qos: 2
      MqttPacketV4Factory.createPublishPacketV4(
        topic,
        message,
        MqttPacketV4Factory.createPublishFlagsV4(2),
        0xffff
      ),
    ].forEach((packet) => {
      it(`emits publish event with provided topic and message when received PUBLISH packet with QOS ${packet.flags.qosLevel}`, () => {
        expect(packet.typeId).toBe(PacketType.PUBLISH);

        // set event listener for publish event
        const onPublish = vi.fn();
        testContext.client.on("publish", onPublish);

        testContext.sendBack(packet); // simulate receiving a PUBLISH packet

        expect(onPublish).toHaveBeenCalledExactlyOnceWith(topic, message);
      });
    });

    describe("received PUBLISH with QoS 2", () => {
      const publishQos2 = (identifier: number, dup = false) =>
        MqttPacketV4Factory.createPublishPacketV4(
          topic,
          message,
          MqttPacketV4Factory.createPublishFlagsV4(2, false, dup),
          identifier
        );

      const pubrec = (identifier: number) =>
        MqttPacketV4Factory.createPacketWithIdentifierV4(
          PacketType.PUBREC,
          identifier
        );

      const pubrel = (identifier: number) =>
        MqttPacketV4Factory.createPacketWithIdentifierV4(
          PacketType.PUBREL,
          identifier
        );

      const pubcomp = (identifier: number) =>
        MqttPacketV4Factory.createPacketWithIdentifierV4(
          PacketType.PUBCOMP,
          identifier
        );

      [1, 0xa1, 0xffff].forEach((packetId) => {
        it(`sends PUBREC with the same packet identifier (${packetId}) and emits publish event when received PUBLISH`, () => {
          const onPublish = vi.fn();
          const onDisconnect = vi.fn();
          testContext.client.on("publish", onPublish);
          testContext.client.on("disconnect", onDisconnect);

          testContext.sendBack(publishQos2(packetId));

          expect(
            testContext.transportMock.send
          ).toHaveBeenCalledExactlyOnceWith(pubrec(packetId));
          expect(onPublish).toHaveBeenCalledExactlyOnceWith(topic, message);
          expect(onDisconnect).not.toHaveBeenCalled();
        });
      });

      // MQTT 3.1.1 section 4.3.3 [MQTT-4.3.3-2].
      it("sends PUBREC again without emitting publish event again when received a duplicate PUBLISH before PUBREL", () => {
        const onPublish = vi.fn();
        testContext.client.on("publish", onPublish);

        testContext.sendBack(publishQos2(7));
        testContext.sendBack(publishQos2(7, true));

        expect(testContext.transportMock.send.mock.calls).toEqual([
          [pubrec(7)],
          [pubrec(7)],
        ]);
        expect(onPublish).toHaveBeenCalledOnce();
      });

      it("sends PUBCOMP with the same packet identifier when received PUBREL", () => {
        testContext.sendBack(publishQos2(7));
        testContext.transportMock.send.mockClear();

        testContext.sendBack(pubrel(7));

        expect(testContext.transportMock.send).toHaveBeenCalledExactlyOnceWith(
          pubcomp(7)
        );
      });

      // The original PUBCOMP might have been lost, so PUBREL can be repeated.
      it("sends PUBCOMP when received PUBREL for an identifier that is no longer stored", () => {
        testContext.sendBack(pubrel(7));

        expect(testContext.transportMock.send).toHaveBeenCalledExactlyOnceWith(
          pubcomp(7)
        );
      });

      // MQTT 3.1.1 section 4.3.3 [MQTT-4.3.3-2].
      it("treats PUBLISH with the same packet identifier after PUBCOMP as a new publication", () => {
        const onPublish = vi.fn();
        testContext.client.on("publish", onPublish);

        testContext.sendBack(publishQos2(7));
        testContext.sendBack(pubrel(7));
        testContext.sendBack(publishQos2(7));

        expect(onPublish).toHaveBeenCalledTimes(2);
        expect(testContext.transportMock.send.mock.calls).toEqual([
          [pubrec(7)],
          [pubcomp(7)],
          [pubrec(7)],
        ]);
      });

      // MQTT 3.1.1 section 3.1.2.4 [MQTT-3.1.2-6].
      it("delivers a PUBLISH with an identifier pending in the previous clean session", async () => {
        const onPublish = vi.fn();
        testContext.client.on("publish", onPublish);

        testContext.sendBack(publishQos2(7));
        expect(onPublish).toHaveBeenCalledExactlyOnceWith(topic, message);
        onPublish.mockClear();

        await testContext.client.disconnect();
        testContext.transportMock.send.mockClear();
        await testContext.connectClientAndClearSendMock();

        testContext.sendBack(publishQos2(7));

        expect(testContext.transportMock.send).toHaveBeenCalledExactlyOnceWith(
          pubrec(7)
        );
        expect(onPublish).toHaveBeenCalledExactlyOnceWith(topic, message);
      });

      // MQTT 3.1.1 [MQTT-3.1.2-4] and [MQTT-4.3.3-2].
      it("does not deliver a duplicate PUBLISH again after resuming the session", async () => {
        const { client, transportMock, sendBack } =
          createMqttClientV4TestContext();
        const connect = async (sessionPresent: boolean) => {
          transportMock.send.mockImplementationOnce(async () => {
            sendBack(MqttPacketV4Factory.createConnackPacketV4(sessionPresent));
          });
          await client.connect("qos2client", undefined, undefined, 0, false);
          transportMock.send.mockClear();
        };

        const onPublish = vi.fn();
        client.on("publish", onPublish);
        await connect(false);
        sendBack(publishQos2(7));
        expect(onPublish).toHaveBeenCalledExactlyOnceWith(topic, message);
        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(pubrec(7));

        await client.disconnect();
        await connect(true);
        sendBack(publishQos2(7, true));

        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(pubrec(7));
        expect(onPublish).toHaveBeenCalledOnce();
      });
    });
  });
});
