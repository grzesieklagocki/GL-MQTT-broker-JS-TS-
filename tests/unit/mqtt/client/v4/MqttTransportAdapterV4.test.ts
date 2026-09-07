import { IMqttPacketCodec } from "@src/mqtt/client/shared/types";
import { MqttTransportAdapterV4 } from "@mqtt/client/v4/MqttTransportAdapterV4";
import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { Socket } from "net";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { PacketType } from "@src/mqtt/protocol/shared/types";

describe("MqttTransportAdapterV4", () => {
  const host = "localhost";
  const port = 1883;

  let codecMock: IMqttPacketCodec<AnyPacketV4>;

  let socketMock: EventEmitter & {
    connect: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  };

  let createSocketMock: () => Socket;

  let adapter: MqttTransportAdapterV4;

  beforeEach(() => {
    codecMock = {
      encode: vi.fn(),
      feed: vi.fn(),
      packetReadyHandler: vi.fn(),
      resetState: vi.fn(),
    };

    socketMock = Object.assign(new EventEmitter(), {
      connect: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
      write: vi.fn(),
    });
    createSocketMock = () => socketMock as unknown as Socket;

    adapter = new MqttTransportAdapterV4(
      codecMock,
      createSocketMock,
      host,
      port
    );
  });

  describe("method", () => {
    describe("connect()", () => {
      it("throws an error if called when the adapter is already connected", async () => {
        expect(adapter.isActive).toBe(false);

        // first connect
        const promise1 = adapter.connect();
        socketMock.emit("connect");
        await expect(promise1).resolves.toBeUndefined();

        expect(adapter.isActive).toBe(true);

        // second connect
        const promise2 = adapter.connect();
        await expect(promise2).rejects.toThrow(
          /Transport adapter is already connected/
        );
      });

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

    describe("send()", () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true,
        30,
        "clientId2"
      );

      it("throws an error if called when the adapter is not connected", async () => {
        const promise = adapter.send(packet);
        await expect(promise).rejects.toThrow(
          /Transport adapter is not connected/
        );
      });

      it("calls codec.encode() with the correct packet", async () => {
        const connectPromise = adapter.connect();
        socketMock.emit("connect");
        await connectPromise;

        await adapter.send(packet);

        expect(codecMock.encode).toHaveBeenCalledExactlyOnceWith(packet);
      });

      it("calls socket.write() with the encoded packet", async () => {
        const encodedPacket = new Uint8Array([1, 2, 3, 5]);

        (codecMock.encode as Mock).mockReturnValueOnce(encodedPacket);

        const connectPromise = adapter.connect();
        socketMock.emit("connect");
        await connectPromise;

        await adapter.send(packet);

        expect(socketMock.write).toHaveBeenCalledExactlyOnceWith(encodedPacket);
      });

      it("throws encode error when codec.encode() throws an error", async () => {
        (codecMock.encode as Mock).mockImplementationOnce(() => {
          throw new Error("ENCODING error");
        });

        const connectPromise = adapter.connect();
        socketMock.emit("connect");
        await connectPromise;

        const sendPromise = adapter.send(packet);

        await expect(sendPromise).rejects.toThrow(/Encoding error/);
      });

      it("throws transport error when socket.write() throws an error", async () => {
        (socketMock.write as Mock).mockImplementationOnce(() => {
          throw new Error("TRANSPORT error");
        });

        const connectPromise = adapter.connect();
        socketMock.emit("connect");
        await connectPromise;

        const sendPromise = adapter.send(packet);

        await expect(sendPromise).rejects.toThrow(/Transport error/);
      });
    });

    describe("disconnect()", () => {
      const error = new Error("ERROR");
      let disconnectListener: (error?: Error) => void;
      let endCallback: (() => void) | undefined;

      beforeEach(async () => {
        // connect
        const promise = adapter.connect();
        socketMock.emit("connect");
        await promise;

        // mock disconnectHandler() callback
        disconnectListener = vi.fn();
        adapter.disconnectHandler = disconnectListener;

        // mock socket.end to capture the callback
        socketMock.end.mockImplementation((callback?: () => void) => {
          endCallback = callback;
        });
      });

      it("throws an error if called when the adapter is not connected", async () => {
        // create independent adapter that is not connected
        const adapter = new MqttTransportAdapterV4(
          codecMock,
          createSocketMock,
          host,
          port
        );

        const promise = adapter.disconnect();

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

    beforeEach(async () => {
      // connect the adapter before testing socket events
      const connectPromise = adapter.connect();
      socketMock.emit("connect");
      await connectPromise;
    });

    describe("data", () => {
      it("throws an error if packetReadyHandler callback is not set when codec emits a packet", () => {
        adapter.disconnectHandler = vi.fn();

        expect(() =>
          codecMock.packetReadyHandler(PacketType.CONNECT, vi.fn())
        ).toThrow(/packetReadyHandler callback is not set/);
      });

      it("invoke codec.feed() with provided bytes when socket emits data", () => {
        socketMock.emit("data", data);

        expect(codecMock.feed).toHaveBeenCalledExactlyOnceWith(data);
      });

      it("invokes packetReadyHandler() callback when codec emits a packet", () => {
        const decodePacketMock = vi.fn();
        adapter.packetReadyHandler = vi.fn((() => true) as () => true | Error);

        codecMock.packetReadyHandler(PacketType.CONNECT, decodePacketMock);

        expect(adapter.packetReadyHandler).toHaveBeenCalledExactlyOnceWith(
          PacketType.CONNECT,
          decodePacketMock
        );
        expect(decodePacketMock).not.toHaveBeenCalled(); // the decode function is just passed through
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
