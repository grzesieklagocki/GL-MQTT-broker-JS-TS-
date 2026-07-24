import { SubscriptionV4 } from "@mqtt/protocol/v4/types";
import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMqttClientV4TestContext } from "./createMqttClientV4TestContext";
import { PacketType } from "@mqtt/protocol/shared/types";

describe("MqttClientV4", () => {
  describe("subscribe()", () => {
    let testContext: ReturnType<typeof createMqttClientV4TestContext>;

    beforeAll(() => {
      vi.useFakeTimers();
    });

    beforeEach(() => {
      testContext = createMqttClientV4TestContext();
    });

    const subscriptionList: SubscriptionV4[] = [
      ["t/1", 2],
      ["t/2", 0],
      ["t/3", 1],
    ];
    const returnCodeList = subscriptionList.map((sub) => sub[1]);

    const subscribePacket = (identifier = 1) =>
      MqttPacketV4Factory.createSubscribePacketV4(identifier, subscriptionList);

    const subackPacket = (identifier = 1) =>
      MqttPacketV4Factory.createSubackPacketV4(identifier, returnCodeList);

    const expectSubscribeSent = (identifier = 1) => {
      expect(testContext.transportMock.send).toHaveBeenCalledExactlyOnceWith(
        subscribePacket(identifier)
      );
    };

    it("rejects when SUBACK is not received before timeout", async () => {
      await testContext.connectClientAndClearSendMock();

      const promise = testContext.client.subscribe(subscriptionList);
      const assertion = expect(promise).rejects.toThrow(/timeout/);

      await vi.advanceTimersByTimeAsync(10_000);

      await assertion;

      expectSubscribeSent();
    });

    it("returns SUBACK return codes when SUBACK is received before timeout", async () => {
      await testContext.connectClientAndClearSendMock();

      testContext.transportMock.send.mockImplementationOnce(() => {
        testContext.transportMock.emit("packetReceived", subackPacket());
      });

      await expect(
        testContext.client.subscribe(subscriptionList)
      ).resolves.toEqual([2, 0, 1]);

      expectSubscribeSent();
    });

    it("rejects when SUBACK is received with a different packet identifier", async () => {
      await testContext.connectClientAndClearSendMock();

      testContext.transportMock.send.mockImplementationOnce(() => {
        testContext.transportMock.emit("packetReceived", subackPacket(55));
      });

      const promise = testContext.client.subscribe(subscriptionList);
      const assertion = expect(promise).rejects.toThrow(/timeout/);

      await vi.advanceTimersByTimeAsync(10_000);

      await assertion;

      expectSubscribeSent();
    });

    it("rejects when respond with a different packet type than SUBACK", async () => {
      await testContext.connectClientAndClearSendMock();

      testContext.transportMock.send.mockImplementationOnce(() => {
        testContext.transportMock.emit(
          "packetReceived",
          MqttPacketV4Factory.createPacketWithIdentifierV4(
            PacketType.UNSUBACK,
            55
          )
        );
      });

      const promise = testContext.client.subscribe(subscriptionList);
      const assertion = expect(promise).rejects.toThrow(/timeout/);

      await vi.advanceTimersByTimeAsync(10_000);

      await assertion;

      expectSubscribeSent();
    });

    it("rejects when client is not connected", async () => {
      expect(testContext.client.isConnected).toBe(false);

      await expect(
        testContext.client.subscribe(subscriptionList)
      ).rejects.toThrow(/not connected/);

      expect(testContext.transportMock.send).not.toHaveBeenCalled();
    });

    it("calls send() on transport adapter", async () => {
      await testContext.connectClientAndClearSendMock();

      testContext.transportMock.send.mockImplementationOnce(() => {
        testContext.transportMock.emit("packetReceived", subackPacket());
      });

      expect(testContext.client.subscribe(subscriptionList)).resolves.toEqual(returnCodeList);

      expect(testContext.transportMock.send).toHaveBeenCalledExactlyOnceWith(
        subscribePacket()
      );
    });
  });
});
