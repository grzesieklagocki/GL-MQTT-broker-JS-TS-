import { IMqttPacketCodec } from "@src/mqtt/client/shared/types";
import { MqttTransportAdapterV4 } from "@mqtt/client/v4/MqttTransportAdapterV4";
import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { Socket } from "net";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("MqttTransportAdapterV4", () => {
  const host = "localhost";
  const port = 1883;

  let codecMock: IMqttPacketCodec<AnyPacketV4>;

  let socketMock: EventEmitter & {
    connect: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };

  let createSocketMock: () => Socket;

  let adapter: MqttTransportAdapterV4;

  beforeEach(() => {
    codecMock = {
      encode: vi.fn(),
      decode: vi.fn(),
      onPacketEvent: vi.fn(),
      resetState: vi.fn(),
    };

    socketMock = Object.assign(new EventEmitter(), {
      connect: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
    });
    createSocketMock = () => socketMock as unknown as Socket;

    adapter = new MqttTransportAdapterV4(
      codecMock,
      createSocketMock,
      host,
      port
    );
  });

  describe("connect()", () => {
    it("calls socket.connect() with the correct host and port", async () => {
      const promise = adapter.connect();

      expect(socketMock.connect).toHaveBeenCalledExactlyOnceWith(port, host);

      socketMock.emit("connect");

      await expect(promise).resolves.toBeUndefined();
    });

    it("resolves when the socket emits connect", async () => {
      const promise = adapter.connect();

      socketMock.emit("connect");

      await expect(promise).resolves.toBeUndefined();
    });

    it("does not resolve before the socket emits connect", async () => {
      const onResolved = vi.fn();

      const promise = adapter.connect().then(onResolved);

      await Promise.resolve();

      expect(onResolved).not.toHaveBeenCalled();

      socketMock.emit("connect");
      await promise;

      expect(onResolved).toHaveBeenCalledOnce();
    });

    it("rejects when the socket emits error before connecting", async () => {
      const error = new Error("Connection refused");

      const promise = adapter.connect();

      socketMock.emit("error", error);

      await expect(promise).rejects.toBe(error);
    });

    it("rejects when the socket closes before connecting", async () => {
      const promise = adapter.connect();

      socketMock.emit("close");

      await expect(promise).rejects.toThrow(/Socket closed/);
    });

    it("has no temporary socket listeners after connecting", async () => {
      const promise = adapter.connect();

      expect(socketMock.listenerCount("connect")).toBe(1);
      expect(socketMock.listenerCount("close")).toBe(1);
      expect(socketMock.listenerCount("error")).toBe(1);

      socketMock.emit("connect");

      await promise;

      expect(socketMock.listenerCount("connect")).toBe(0);
      expect(socketMock.listenerCount("close")).toBe(1); // new listener still listening for disconnects
      expect(socketMock.listenerCount("error")).toBe(1); // new listener still listening for disconnects
    });

    it("removes socket listeners after an error", async () => {
      const promise = adapter.connect();

      socketMock.emit("error", new Error("error"));

      await expect(promise).rejects.toThrow("error");

      expect(socketMock.listenerCount("connect")).toBe(0);
      expect(socketMock.listenerCount("close")).toBe(0);
      expect(socketMock.listenerCount("error")).toBe(0);
    });

    it("removes socket listeners after the socket close", async () => {
      const promise = adapter.connect();

      socketMock.emit("close");

      await expect(promise).rejects.toThrow();

      expect(socketMock.listenerCount("connect")).toBe(0);
      expect(socketMock.listenerCount("close")).toBe(0);
      expect(socketMock.listenerCount("error")).toBe(0);
    });
  });

  describe("disconnect()", () => {
    it("throws an error if called when the adapter is not connected", async () => {
      const promise = adapter.disconnect();

      expect(promise).rejects.toThrow();
    });
  });
  describe("disconnect()", () => {
    const error = new Error("ERROR");
    let endCallback: (() => void) | undefined;

    beforeEach(async () => {
      // connect
      const promise = adapter.connect();
      socketMock.emit("connect");
      await promise;

      // mock socket.end to capture the callback
      socketMock.end.mockImplementation((callback?: () => void) => {
        endCallback = callback;
      });
    });

    it("emits 'disconnect' event when called without an error", async () => {
      const disconnectListener = vi.fn();
      adapter.on("disconnect", disconnectListener);

      const promise = adapter.disconnect();
      endCallback!(); // simulate socket closing
      await expect(promise).resolves.toBeUndefined();

      expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(undefined);
    });

    it("emits 'disconnect' event when called with an error", async () => {
      const disconnectListener = vi.fn();
      adapter.on("disconnect", disconnectListener);

      const promise = adapter.disconnect(error);
      await expect(promise).resolves.toBeUndefined();

      expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(error);
    });

    it("calls socket.end() when called without an error", async () => {
      const promise = adapter.disconnect();

      expect(socketMock.end).toHaveBeenCalledExactlyOnceWith(endCallback);
      expect(endCallback).toBeTypeOf("function");

      endCallback!(); // simulate socket closing
      await expect(promise).resolves.toBeUndefined();
    });

    it("calls socket.destroy() when called with an error", async () => {
      const promise = adapter.disconnect(error);

      expect(socketMock.destroy).toHaveBeenCalledExactlyOnceWith(error);

      await expect(promise).resolves.toBeUndefined();
    });

    it("clears the socket reference when called without an error", async () => {
      expect(socketMock.listenerCount("data")).toBe(1);
      expect(socketMock.listenerCount("close")).toBe(1);
      expect(socketMock.listenerCount("error")).toBe(1);

      const promise = adapter.disconnect();
      endCallback!(); // simulate socket closing
      await expect(promise).resolves.toBeUndefined();

      expect(socketMock.listenerCount("data")).toBe(0);
      expect(socketMock.listenerCount("close")).toBe(0);
      expect(socketMock.listenerCount("error")).toBe(0);
    });

    it("clears the socket reference when called with an error", async () => {
      expect(socketMock.listenerCount("data")).toBe(1);
      expect(socketMock.listenerCount("close")).toBe(1);
      expect(socketMock.listenerCount("error")).toBe(1);

      const promise = adapter.disconnect(error);
      await expect(promise).resolves.toBeUndefined();

      expect(socketMock.listenerCount("data")).toBe(0);
      expect(socketMock.listenerCount("close")).toBe(0);
      expect(socketMock.listenerCount("error")).toBe(0);
    });
  });
});
