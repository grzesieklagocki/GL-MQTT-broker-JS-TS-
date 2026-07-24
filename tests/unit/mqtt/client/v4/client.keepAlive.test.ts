import { beforeEach } from "vitest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createMqttClientV4TestContext } from "./createMqttClientV4TestContext";
import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { PacketType } from "@mqtt/protocol/shared/types";

describe("MqttClientV4", () => {
  describe("keep alive mechanism", () => {
    let testContext: ReturnType<typeof createMqttClientV4TestContext>;

    const pingreqPacket = () =>
      MqttPacketV4Factory.createSimplePacketV4(PacketType.PINGREQ);

    const pingrespPacket = () =>
      MqttPacketV4Factory.createSimplePacketV4(PacketType.PINGRESP);

    const emitPingresp = () => {
      testContext.transportMock.emit("packetReceived", pingrespPacket());
    };

    const expectPingreqSentOnce = () => {
      expect(testContext.transportMock.send).toHaveBeenCalledExactlyOnceWith(
        pingreqPacket()
      );
    };

    beforeAll(() => {
      vi.useFakeTimers();
    });

    beforeEach(async () => {
      testContext = createMqttClientV4TestContext();
      await testContext.connectClientAndClearSendMock();
    });

    it("sends PINGREQ when keep alive expires and no other packet is sent", async () => {
      await vi.advanceTimersByTimeAsync(60_000);

      expectPingreqSentOnce();
    });

    it("sends PINGREQ repeatedly after each PINGRESP", async () => {
      for (let i = 1; i <= 10; i++) {
        await vi.advanceTimersByTimeAsync(60_000);

        expect(testContext.transportMock.send).toHaveBeenCalledTimes(i);
        expect(testContext.transportMock.send).toHaveBeenLastCalledWith(
          pingreqPacket()
        );

        emitPingresp();
      }
    });

    it("does not send PINGREQ when another packet is sent before keep alive expires", async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await testContext.client.publish("TEST TOPIC", new Uint8Array([1, 2]));

      testContext.transportMock.send.mockClear();
      await vi.advanceTimersByTimeAsync(30_000);

      expect(testContext.transportMock.send).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(30_000);
      expectPingreqSentOnce();
    });

    it("disconnects when PINGRESP is not received before the next keep alive interval", async () => {
      await vi.advanceTimersByTimeAsync(60_000);
      expectPingreqSentOnce();

      await vi.advanceTimersByTimeAsync(60_000);

      expect(testContext.client.isConnected).toBe(false);
    });
  });
});
