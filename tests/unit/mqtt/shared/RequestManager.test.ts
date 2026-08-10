import { RequestManager } from "@mqtt/shared/RequestManager";
import { PacketType } from "@mqtt/protocol/shared/types";
import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("RequestManager", () => {
  let sendActionMock: ReturnType<typeof vi.fn>;
  let requestManager: RequestManager;

  beforeEach(() => {
    sendActionMock = vi.fn().mockResolvedValue(undefined);
    requestManager = new RequestManager(sendActionMock);
  });

  describe("sendAndWaitForResponse()", () => {
    it("sends request and resolves with matching response", async () => {
      const request = {
        typeId: PacketType.SUBSCRIBE,
        identifier: 10,
      } as AnyPacketV4;

      const response = {
        typeId: PacketType.SUBACK,
        identifier: 10,
      } as AnyPacketV4;

      const promise = requestManager.sendAndWaitForResponse(
        request,
        1,
        new Error("timeout")
      );

      expect(sendActionMock).toHaveBeenCalledExactlyOnceWith(request);

      requestManager.complete(response);

      await expect(promise).resolves.toBe(response);
    });

    it("supports multiple pending requests", async () => {
      const request1 = {
        typeId: PacketType.SUBSCRIBE,
        identifier: 10,
      } as AnyPacketV4;

      const request2 = {
        typeId: PacketType.UNSUBSCRIBE,
        identifier: 20,
      } as AnyPacketV4;

      const response1 = {
        typeId: PacketType.SUBACK,
        identifier: 10,
      } as AnyPacketV4;

      const response2 = {
        typeId: PacketType.UNSUBACK,
        identifier: 20,
      } as AnyPacketV4;

      const promise1 = requestManager.sendAndWaitForResponse(
        request1,
        1,
        new Error("timeout")
      );

      const promise2 = requestManager.sendAndWaitForResponse(
        request2,
        1,
        new Error("timeout")
      );

      requestManager.complete(response2);
      requestManager.complete(response1);

      await expect(promise1).resolves.toBe(response1);
      await expect(promise2).resolves.toBe(response2);

      expect(sendActionMock).toHaveBeenCalledTimes(2);
      expect(sendActionMock).toHaveBeenNthCalledWith(1, request1);
      expect(sendActionMock).toHaveBeenNthCalledWith(2, request2);
    });

    it("rejects when request packet has no identifier", async () => {
      const request = {
        typeId: PacketType.PINGREQ,
      } as AnyPacketV4;

      await expect(
        requestManager.sendAndWaitForResponse(request, 1, new Error("timeout"))
      ).rejects.toThrow("Packet identifier is undefined.");

      expect(sendActionMock).not.toHaveBeenCalled();
    });

    it("rejects when response packet type does not match expected response type", async () => {
      const request = {
        typeId: PacketType.SUBSCRIBE,
        identifier: 10,
      } as AnyPacketV4;

      const response = {
        typeId: PacketType.PUBACK,
        identifier: 10,
      } as AnyPacketV4;

      const promise = requestManager.sendAndWaitForResponse(
        request,
        1,
        new Error("timeout")
      );

      requestManager.complete(response);

      await expect(promise).rejects.toThrow(
        /not matches expected response for identifier: 10/
      );
    });

    it("rejects when timeout expires before response is completed", async () => {
      vi.useFakeTimers();

      const request = {
        typeId: PacketType.SUBSCRIBE,
        identifier: 10,
      } as AnyPacketV4;

      const timeoutError = new Error("Request timeout.");

      const promise = requestManager.sendAndWaitForResponse(
        request,
        1,
        timeoutError
      );

      const rejection = expect(promise).rejects.toThrow("Request timeout.");

      await vi.advanceTimersByTimeAsync(1_000);

      await rejection;

      vi.useRealTimers();
    });

    it("rejects when sendAction returns rejected promise", async () => {
      const error = new Error("Transport error");

      sendActionMock.mockRejectedValueOnce(error);

      const request = {
        typeId: PacketType.SUBSCRIBE,
        identifier: 10,
      } as AnyPacketV4;

      await expect(
        requestManager.sendAndWaitForResponse(request, 10, new Error("timeout"))
      ).rejects.toThrow("Transport error");
    });
  });

  describe("complete()", () => {
    it("throws when response has no identifier", () => {
      const response = {
        typeId: PacketType.PINGRESP,
      } as AnyPacketV4;

      expect(() => requestManager.complete(response)).toThrow(
        "Packet identifier is undefined."
      );
    });

    it("throws when there is no pending request for identifier", () => {
      const response = {
        typeId: PacketType.SUBACK,
        identifier: 55,
      } as AnyPacketV4;

      expect(() => requestManager.complete(response)).toThrow(
        "No pending request for identifier: 55"
      );
    });

    it("removes completed request from pending requests", async () => {
      const request = {
        typeId: PacketType.SUBSCRIBE,
        identifier: 10,
      } as AnyPacketV4;

      const response = {
        typeId: PacketType.SUBACK,
        identifier: 10,
      } as AnyPacketV4;

      const promise = requestManager.sendAndWaitForResponse(
        request,
        1,
        new Error("timeout")
      );

      requestManager.complete(response);

      await expect(promise).resolves.toBe(response);

      expect(() => requestManager.complete(response)).toThrow(
        "No pending request for identifier: 10"
      );
    });

    it("removes pending request after timeout", async () => {
      vi.useFakeTimers();

      const request = {
        typeId: PacketType.SUBSCRIBE,
        identifier: 10,
      } as AnyPacketV4;

      const response = {
        typeId: PacketType.SUBACK,
        identifier: 10,
      } as AnyPacketV4;

      const promise = requestManager.sendAndWaitForResponse(
        request,
        1,
        new Error("timeout")
      );

      const rejection = expect(promise).rejects.toThrow("timeout");

      await vi.advanceTimersByTimeAsync(1_000);

      await rejection;

      expect(() => requestManager.complete(response)).toThrow(
        "No pending request for identifier: 10"
      );

      vi.useRealTimers();
    });
  });
});
