import { IMqttPacketCodec } from "@mqtt/shared/types";
import { MqttSocketTransportAdapter } from "@mqtt/shared/MqttSocketTransportAdapter";
import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { Socket } from "net";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { PacketType } from "@mqtt/protocol/shared/types";

describe("MqttSocketTransportAdapter", () => {
  let codecMock: IMqttPacketCodec<AnyPacketV4>;

  let socketMock: EventEmitter & {
    end: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  };

  let adapter: MqttSocketTransportAdapter<AnyPacketV4>;

  beforeEach(() => {
    codecMock = {
      encode: vi.fn(),
      feed: vi.fn(),
      packetDecodedHandler: vi.fn(),
      resetState: vi.fn(),
    };

    socketMock = Object.assign(new EventEmitter(), {
      end: vi.fn(),
      destroy: vi.fn(),
      write: vi.fn(),
    });

    adapter = new MqttSocketTransportAdapter(
      codecMock,
      socketMock as unknown as Socket
    );
  });

  describe("constructor", () => {
    it("is active immediately when a socket is provided", () => {
      expect(adapter.isActive).toBe(true);
    });

    it("registers socket listeners for data, close and error when a socket is provided", () => {
      expect(socketMock.listenerCount("data")).toBe(1);
      expect(socketMock.listenerCount("close")).toBe(1);
      expect(socketMock.listenerCount("error")).toBe(1);
    });

    it("is not active when no socket is provided", () => {
      const detachedAdapter = new MqttSocketTransportAdapter(codecMock);

      expect(detachedAdapter.isActive).toBe(false);
    });
  });

  describe("method", () => {
    describe("send()", () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true,
        30,
        "clientId2"
      );

      it("throws an error if called when the adapter is not connected", async () => {
        const detachedAdapter = new MqttSocketTransportAdapter(codecMock);

        const promise = detachedAdapter.send(packet);

        await expect(promise).rejects.toThrow(
          /Transport adapter is not connected/
        );
      });

      it("calls codec.encode() with the correct packet", async () => {
        await adapter.send(packet);

        expect(codecMock.encode).toHaveBeenCalledExactlyOnceWith(packet);
      });

      it("calls socket.write() with the encoded packet", async () => {
        const encodedPacket = new Uint8Array([1, 2, 3, 5]);

        (codecMock.encode as Mock).mockReturnValueOnce(encodedPacket);

        await adapter.send(packet);

        expect(socketMock.write).toHaveBeenCalledExactlyOnceWith(encodedPacket);
      });

      it("throws encode error when codec.encode() throws an error", async () => {
        (codecMock.encode as Mock).mockImplementationOnce(() => {
          throw new Error("ENCODING error");
        });

        const sendPromise = adapter.send(packet);

        await expect(sendPromise).rejects.toThrow(/Encoding error/);
      });

      it("throws transport error when socket.write() throws an error", async () => {
        (socketMock.write as Mock).mockImplementationOnce(() => {
          throw new Error("TRANSPORT error");
        });

        const sendPromise = adapter.send(packet);

        await expect(sendPromise).rejects.toThrow(/Transport error/);
      });
    });

    describe("disconnect()", () => {
      const error = new Error("ERROR");
      let disconnectListener: (error?: Error) => void;
      let endCallback: (() => void) | undefined;

      beforeEach(() => {
        disconnectListener = vi.fn();
        adapter.disconnectHandler = disconnectListener;
        endCallback = undefined;

        // mock socket.end to capture the callback
        socketMock.end.mockImplementation((callback?: () => void) => {
          endCallback = callback;
        });
      });

      it("throws an error if called when the adapter is not connected", async () => {
        const detachedAdapter = new MqttSocketTransportAdapter(codecMock);

        const promise = detachedAdapter.disconnect();

        await expect(promise).rejects.toThrow(
          /Transport adapter is not connected/
        );
      });

      it("invokes disconnectHandler() callback when called without an error", async () => {
        const promise = adapter.disconnect();
        endCallback!();
        socketMock.emit("close", false);
        await expect(promise).resolves.toBeUndefined();

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(undefined);
      });

      it("invokes disconnectHandler() callback when called with an error", async () => {
        const promise = adapter.disconnect(error);
        socketMock.emit("close", true);
        await expect(promise).resolves.toBeUndefined();

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(error);
      });

      it("calls codec.resetState() when called without an error", async () => {
        const promise = adapter.disconnect();
        endCallback!();
        socketMock.emit("close", false);
        await expect(promise).resolves.toBeUndefined();

        expect(codecMock.resetState).toHaveBeenCalledExactlyOnceWith();
      });

      it("calls codec.resetState() when called with an error", async () => {
        const promise = adapter.disconnect(error);
        socketMock.emit("close", true);
        await expect(promise).resolves.toBeUndefined();

        expect(codecMock.resetState).toHaveBeenCalledExactlyOnceWith();
      });

      it("calls socket.end() when called without an error", async () => {
        const promise = adapter.disconnect();

        expect(socketMock.end).toHaveBeenCalledExactlyOnceWith(endCallback);
        expect(endCallback).toBeTypeOf("function");

        endCallback!();
        expect(socketMock.destroy).toHaveBeenCalledExactlyOnceWith();
        socketMock.emit("close", false);
        await expect(promise).resolves.toBeUndefined();
      });

      it("calls socket.destroy() when called with an error", async () => {
        const promise = adapter.disconnect(error);

        expect(socketMock.destroy).toHaveBeenCalledExactlyOnceWith(error);

        socketMock.emit("close", true);
        await expect(promise).resolves.toBeUndefined();
      });

      it("clears the socket reference when called without an error", async () => {
        expect(socketMock.listenerCount("data")).toBe(1);
        expect(socketMock.listenerCount("close")).toBe(1);
        expect(socketMock.listenerCount("error")).toBe(1);

        const promise = adapter.disconnect();
        endCallback!();
        socketMock.emit("close", false);
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
        socketMock.emit("close", true);
        await expect(promise).resolves.toBeUndefined();

        expect(socketMock.listenerCount("data")).toBe(0);
        expect(socketMock.listenerCount("close")).toBe(0);
        expect(socketMock.listenerCount("error")).toBe(0);
      });

      it.each([
        { reason: "without an error", error: undefined },
        { reason: "with an error", error: new Error("Transport failure") },
      ])(
        "does not resolve before the socket emits close when called $reason",
        async ({ error }) => {
          const onResolved = vi.fn();

          const promise = adapter.disconnect(error).then(onResolved);
          endCallback?.(); // finish writing without closing the socket

          // Allow settled promises to run before checking for premature resolution.
          await new Promise<void>((resolve) => setImmediate(resolve));
          const resolvedBeforeClose = onResolved.mock.calls.length;

          socketMock.emit("close", error !== undefined);
          await promise;

          expect(resolvedBeforeClose).toBe(0);
          expect(onResolved).toHaveBeenCalledOnce();
        }
      );

      it("resolves repeated calls without repeating cleanup", async () => {
        const promise1 = adapter.disconnect();
        const promise2 = adapter.disconnect();
        // Observe both promises immediately to handle any rejection.
        const assertions = Promise.all([
          expect(promise1).resolves.toBeUndefined(),
          expect(promise2).resolves.toBeUndefined(),
        ]);

        endCallback?.();
        socketMock.emit("close", false);
        await assertions;

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(undefined);
        expect(codecMock.resetState).toHaveBeenCalledExactlyOnceWith();
      });

      it("handles socket errors until the socket emits close", async () => {
        const promise = adapter.disconnect(error);

        expect(() => socketMock.emit("error", error)).not.toThrow();
        socketMock.emit("close", true);
        await expect(promise).resolves.toBeUndefined();

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(error);
        expect(socketMock.listenerCount("error")).toBe(0);
      });

      it("rejects sending packets while the socket is closing", async () => {
        const packet = MqttPacketV4Factory.createSimplePacketV4(PacketType.PINGREQ);
        const promise = adapter.disconnect();

        await expect(adapter.send(packet)).rejects.toThrow(
          /Transport adapter is not connected/
        );
        socketMock.emit("close", false);
        await promise;

        expect(socketMock.write).not.toHaveBeenCalled();
      });

      it("does not forward bytes or decoded packets while closing", async () => {
        const packet = MqttPacketV4Factory.createSimplePacketV4(PacketType.PINGREQ);
        const packetListener = vi.fn();
        adapter.packetReceivedHandler = packetListener;
        const promise = adapter.disconnect();

        socketMock.emit("data", new Uint8Array([1, 2, 3]));
        codecMock.packetDecodedHandler(packet);
        socketMock.emit("close", false);
        await promise;

        expect(codecMock.feed).not.toHaveBeenCalled();
        expect(packetListener).not.toHaveBeenCalled();
      });
    });
  });

  describe("on socket event", () => {
    const data = new Uint8Array([1, 2, 3, 4]);

    describe("data", () => {
      const packet = MqttPacketV4Factory.createSimplePacketV4(
        PacketType.PINGREQ
      );

      it("throws an error if packetReceivedHandler callback is not set when codec emits a packet", () => {
        adapter.disconnectHandler = vi.fn();

        expect(() => codecMock.packetDecodedHandler(packet)).toThrow(
          /packetReceivedHandler callback is not set/
        );
      });

      it("invokes codec.feed() with provided bytes when socket emits data", () => {
        socketMock.emit("data", data);

        expect(codecMock.feed).toHaveBeenCalledExactlyOnceWith(data);
      });

      it("closes the socket when codec.feed() throws", () => {
        const error = new Error("Decoding failed");
        const packetListener = vi.fn();
        const disconnectListener = vi.fn();

        adapter.packetReceivedHandler = packetListener;
        adapter.disconnectHandler = disconnectListener;
        vi.mocked(codecMock.feed).mockImplementationOnce(() => {
          throw error;
        });

        expect(() => socketMock.emit("data", data)).not.toThrow();
        expect(socketMock.destroy).toHaveBeenCalledExactlyOnceWith(error);
        expect(packetListener).not.toHaveBeenCalled();
        expect(disconnectListener).not.toHaveBeenCalled();

        socketMock.emit("error", error);
        socketMock.emit("close", true);

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(error);
        expect(codecMock.resetState).toHaveBeenCalledTimes(1);
      });

      it("invokes packetReceivedHandler() callback when codec emits a packet", () => {
        adapter.packetReceivedHandler = vi.fn();

        codecMock.packetDecodedHandler(packet);

        expect(adapter.packetReceivedHandler).toHaveBeenCalledExactlyOnceWith(
          packet
        );
      });
    });

    describe("close", () => {
      it("allows disconnect() after a remote close without repeating cleanup", async () => {
        const disconnectListener = vi.fn();
        adapter.disconnectHandler = disconnectListener;

        socketMock.emit("close", false);
        await expect(adapter.disconnect()).resolves.toBeUndefined();

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(undefined);
        expect(codecMock.resetState).toHaveBeenCalledExactlyOnceWith();
      });

      it("invokes disconnectHandler() without an error when hadError is false", async () => {
        const disconnectListener = vi.fn();
        adapter.disconnectHandler = disconnectListener;
        socketMock.end.mockImplementation((callback?: () => void) => callback?.());
        const closeListener = socketMock.listeners("close")[0] as (
          hadError: boolean
        ) => void | Promise<void>;

        await closeListener(false);

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(undefined);
      });

      it("does not call socket.end() or socket.destroy() after the socket closes", async () => {
        adapter.disconnectHandler = vi.fn();
        socketMock.end.mockImplementation((callback?: () => void) => callback?.());
        const closeListener = socketMock.listeners("close")[0] as (
          hadError: boolean
        ) => void | Promise<void>;

        await closeListener(false);

        expect(socketMock.end).not.toHaveBeenCalled();
        expect(socketMock.destroy).not.toHaveBeenCalled();
      });

      it("throws an error if disconnectHandler callback is not set when socket emits close", () => {
        const closeListener = socketMock.listeners(
          "close"
        )[0] as (hadError: boolean) => void;

        expect(() => closeListener(false)).toThrow(
          /disconnectHandler callback is not set/
        );
      });

      it("invokes disconnectHandler() callback when socket emits close without error", () => {
        const disconnectListener = vi.fn();

        adapter.disconnectHandler = disconnectListener;

        socketMock.emit("close", false);

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(undefined);
      });

      it("invokes disconnectHandler() callback when socket emits close with error", () => {
        const disconnectListener = vi.fn();

        adapter.disconnectHandler = disconnectListener;

        const error = new Error("ERR");

        socketMock.emit("error", error);
        socketMock.emit("close", true);

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(error);
      });
    });

    describe("error", () => {
      it("invokes disconnectHandler() with the original error and resets the codec once when followed by close", () => {
        const error = new Error("Transport failure");
        const disconnectListener = vi.fn();

        adapter.disconnectHandler = disconnectListener;

        socketMock.emit("error", error);
        socketMock.emit("close", true);

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(error);
        expect(codecMock.resetState).toHaveBeenCalledExactlyOnceWith();
      });
    });
  });
});
