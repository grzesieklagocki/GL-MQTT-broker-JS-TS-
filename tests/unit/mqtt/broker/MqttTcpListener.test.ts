import { EventEmitter } from "node:events";
import { createServer, Server } from "node:net";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MqttTcpListener } from "@mqtt/broker/MqttTcpListener";
import { MqttSocketTransportAdapter } from "@mqtt/shared/MqttSocketTransportAdapter";

vi.mock("node:net", () => ({ createServer: vi.fn() }));

describe("MqttTcpListener", () => {
  const host = "127.0.0.1";
  const port = 1883;
  let serverMock: EventEmitter & {
    listen: ReturnType<typeof vi.fn>;
    close: ReturnType<
      typeof vi.fn<(callback?: (error?: Error) => void) => EventEmitter>
    >;
  };
  let listener: MqttTcpListener;

  const createSocketMock = () =>
    Object.assign(new EventEmitter(), {
      remoteAddress: "127.0.0.1",
      remotePort: 53124,
      destroy: vi.fn(),
    });

  beforeEach(() => {
    serverMock = Object.assign(new EventEmitter(), {
      listen: vi.fn(),
      close: vi.fn<(callback?: (error?: Error) => void) => EventEmitter>(),
    });
    serverMock.listen.mockReturnValue(serverMock);
    serverMock.close.mockReturnValue(serverMock);
    vi.mocked(createServer).mockImplementation(
      (options, connectionListener) => {
        const handler =
          typeof options === "function" ? options : connectionListener;
        if (handler) serverMock.on("connection", handler);
        return serverMock as unknown as Server;
      }
    );
    listener = new MqttTcpListener(host, port);
    listener.connectionHandler = vi.fn();
    listener.closeHandler = vi.fn();
  });

  it("starts listening on the configured host and port", () => {
    listener.listen();

    expect(serverMock.listen).toHaveBeenCalledExactlyOnceWith(port, host);
  });

  it("passes the accepted socket to the broker as a packet transport with endpoint info", () => {
    listener.listen();
    const socket = createSocketMock();

    serverMock.emit("connection", socket);

    expect(listener.connectionHandler).toHaveBeenCalledExactlyOnceWith({
      transport: expect.any(MqttSocketTransportAdapter),
      info: "127.0.0.1:53124",
    });
    expect(socket.destroy).not.toHaveBeenCalled();
  });

  it("reports an asynchronous listen error through closeHandler", () => {
    const error = new Error("Address already in use");
    listener.listen();

    serverMock.emit("error", error);

    expect(listener.closeHandler).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("waits for server closure before resolving stop()", async () => {
    listener.listen();
    const onStopped = vi.fn();

    const stopped = listener.stop().then(onStopped);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(serverMock.close).toHaveBeenCalledTimes(1);
    expect(onStopped).not.toHaveBeenCalled();
    expect(listener.closeHandler).not.toHaveBeenCalled();

    serverMock.emit("close");
    serverMock.close.mock.calls[0][0]?.();
    await stopped;

    expect(listener.closeHandler).toHaveBeenCalledTimes(1);
    expect(vi.mocked(listener.closeHandler).mock.calls[0][0]).toBeUndefined();
  });

  it("destroys a socket accepted during shutdown without passing it to the broker", async () => {
    listener.listen();
    const socket = createSocketMock();
    const stopped = listener.stop();

    serverMock.emit("connection", socket);

    expect(socket.destroy).toHaveBeenCalledExactlyOnceWith();
    expect(listener.connectionHandler).not.toHaveBeenCalled();

    serverMock.emit("close");
    serverMock.close.mock.calls[0][0]?.();
    await stopped;
  });
});
