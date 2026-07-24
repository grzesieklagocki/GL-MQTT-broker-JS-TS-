import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMqttClientV4TestContext } from "./createMqttClientV4TestContext";
import { PacketType } from "@mqtt/protocol/shared/types";

describe("MqttClientV4", () => {
  describe("unsubscribe()", () => {
    let testContext: ReturnType<typeof createMqttClientV4TestContext>;

    beforeAll(() => {
      vi.useFakeTimers();
    });

    beforeEach(() => {
      testContext = createMqttClientV4TestContext();
    });

    const unsubscribePacket = (identifier = 1) =>
      MqttPacketV4Factory.createUnsubscribePacketV4(identifier, []);

    const unsubackPacket = (identifier = 1) =>
      MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.UNSUBACK,
        identifier
      );

    const expectUnsubscribeSent = (identifier = 1) => {
      expect(testContext.transportMock.send).toHaveBeenCalledExactlyOnceWith(
        unsubscribePacket(identifier)
      );
    };

    it("rejects when UNSUBACK is not received before timeout", async () => {
      await testContext.connectClientAndClearSendMock();

      const promise = testContext.client.unsubscribe([]);
      const assertion = expect(promise).rejects.toThrow(/timeout/);

      await vi.advanceTimersByTimeAsync(10_000);

      await assertion;

      expectUnsubscribeSent();
    });

    it("resolves when UNSUBACK is received before timeout", async () => {
      await testContext.connectClientAndClearSendMock();

      testContext.transportMock.send.mockImplementationOnce(() => {
        testContext.transportMock.emit("packetReceived", unsubackPacket(1));
      });

      await expect(testContext.client.unsubscribe([])).resolves.toBeUndefined();

      expectUnsubscribeSent();
    });

    it("rejects when UNSUBACK is received with a different packet identifier", async () => {
      await testContext.connectClientAndClearSendMock();

      testContext.transportMock.send.mockImplementationOnce(() => {
        testContext.transportMock.emit("packetReceived", unsubackPacket(55));
      });

      const promise = testContext.client.unsubscribe([]);
      const assertion = expect(promise).rejects.toThrow(/timeout/);

      await vi.advanceTimersByTimeAsync(10_000);

      await assertion;

      expectUnsubscribeSent();
    });

    it("rejects when response has a different packet type than UNSUBACK", async () => {
      await testContext.connectClientAndClearSendMock();

      testContext.transportMock.send.mockImplementationOnce(() => {
        testContext.transportMock.emit(
          "packetReceived",
          MqttPacketV4Factory.createSubackPacketV4(1, [])
        );
      });

      const promise = testContext.client.unsubscribe([]);
      const assertion = expect(promise).rejects.toThrow(/timeout/);

      await vi.advanceTimersByTimeAsync(10_000);

      await assertion;

      expectUnsubscribeSent();
    });

    it("rejects when client is not connected", async () => {
      expect(testContext.client.isConnected).toBe(false);

      await expect(testContext.client.unsubscribe([])).rejects.toThrow(
        /not connected/
      );

      expect(testContext.transportMock.send).not.toHaveBeenCalled();
    });

    it("calls send() on transport adapter", async () => {
      await testContext.connectClientAndClearSendMock();

      testContext.transportMock.send.mockImplementationOnce(() => {
        testContext.transportMock.emit("packetReceived", unsubackPacket());
      });

      expect(testContext.client.unsubscribe([])).resolves.toBeUndefined();

      expect(testContext.transportMock.send).toHaveBeenCalledExactlyOnceWith(
        unsubscribePacket()
      );
    });
  });
});
