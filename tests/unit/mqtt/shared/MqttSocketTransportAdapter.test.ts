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
        endCallback!(); // simulate socket closing
        await expect(promise).resolves.toBeUndefined();

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(undefined);
      });

      it("invokes disconnectHandler() callback when called with an error", async () => {
        const promise = adapter.disconnect(error);
        await expect(promise).resolves.toBeUndefined();

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(error);
      });

      it("calls codec.resetState() when called without an error", async () => {
        const promise = adapter.disconnect();
        endCallback!(); // simulate socket closing
        await expect(promise).resolves.toBeUndefined();

        expect(codecMock.resetState).toHaveBeenCalledExactlyOnceWith();
      });

      it("calls codec.resetState() when called with an error", async () => {
        const promise = adapter.disconnect(error);
        await expect(promise).resolves.toBeUndefined();

        expect(codecMock.resetState).toHaveBeenCalledExactlyOnceWith();
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

      it("invokes packetReceivedHandler() callback when codec emits a packet", () => {
        adapter.packetReceivedHandler = vi.fn();

        codecMock.packetDecodedHandler(packet);

        expect(adapter.packetReceivedHandler).toHaveBeenCalledExactlyOnceWith(
          packet
        );
      });
    });

    describe("close", () => {
      it("throws an error if disconnectHandler callback is not set when socket emits close", async () => {
        const closeListener = socketMock.listeners(
          "close"
        )[0] as () => Promise<void>;

        await expect(closeListener()).rejects.toThrow(
          /disconnectHandler callback is not set/
        );
      });

      it("invokes disconnectHandler() callback when socket emits close without error", () => {
        const disconnectListener = vi.fn();

        adapter.disconnectHandler = disconnectListener;

        socketMock.emit("close");

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(undefined);
      });

      it("invokes disconnectHandler() callback when socket emits close with error", () => {
        const disconnectListener = vi.fn();

        adapter.disconnectHandler = disconnectListener;

        const error = new Error("ERR");

        socketMock.emit("close", error);

        expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(error);
      });
    });
  });
});
