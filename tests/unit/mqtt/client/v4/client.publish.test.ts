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
          testContext.transportMock.emit("packetReceived", pubackPacket(1));
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
          testContext.transportMock.emit("packetReceived", pubackPacket(55));
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

      it("ignores different packet type and rejects after timeout", async () => {
        testContext.transportMock.send.mockImplementationOnce(() => {
          testContext.transportMock.emit(
            "packetReceived",
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
        const assertion = expect(promise).rejects.toThrow(/timeout/);

        await vi.advanceTimersByTimeAsync(10_000);

        await assertion;

        expectPublishSent(1, 1);
      });
    });

    describe("QoS 2", () => {
      it.todo("TODO QoS 2");
    });

    it("sends nothing when received PUBLISH packet with QOS 0", () => {
      const packet = MqttPacketV4Factory.createPublishPacketV4("topic");

      expect(packet.typeId).toBe(PacketType.PUBLISH);
      expect(packet.flags.qosLevel).toBe(0);

      testContext.transportMock.emit("packetReceived", packet); // simulate receiving a PUBLISH packet

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

        testContext.transportMock.emit("packetReceived", packet); // simulate receiving a PUBLISH packet by client

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

    it.todo("TODO: when received PUBLISH packet with QOS 2");

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
      // MqttPacketV4Factory.createPublishPacketV4(
      //   topic,
      //   message,
      //   MqttPacketV4Factory.createPublishFlagsV4(2),
      //   0xffff
      // ),
    ].forEach((packet) => {
      it(`emits publish event with provided topic and message when received PUBLISH packet with QOS ${packet.flags.qosLevel}`, () => {
        expect(packet.typeId).toBe(PacketType.PUBLISH);

        // set event listener for publish event
        const onPublish = vi.fn();
        testContext.client.on("publish", onPublish);

        testContext.transportMock.emit("packetReceived", packet); // simulate receiving a PUBLISH packet

        expect(onPublish).toHaveBeenCalledExactlyOnceWith(topic, message);
      });
    });

    it.todo(
      "TODO: call publish event with provided topic and message when received PUBLISH packet with QOS 2"
    );
  });
});
