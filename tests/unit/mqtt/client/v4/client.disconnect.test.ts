import { MqttClientV4 } from "@mqtt/client/v4/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMqttClientV4TestContext } from "./createMqttClientV4TestContext";
import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { PacketType } from "@mqtt/protocol/shared/types";

describe("disconnect()", () => {
  let testContext: ReturnType<typeof createMqttClientV4TestContext>;

  const disconnectListener = vi.fn();
  const error = new Error("TRANSPORT DISCONNECT");

  beforeEach(async () => {
    testContext = createMqttClientV4TestContext();

    testContext.client.on("disconnect", disconnectListener);
    disconnectListener.mockReset();

    await testContext.connectClientAndClearSendMock();
  });

  it("rejects when client is not connected", async () => {
    // disconnect before calling disconnect() again
    await testContext.client.disconnect();
    expect(testContext.client.isConnected).toBe(false);

    await expect(testContext.client.disconnect()).rejects.toThrow(
      /not connected/
    );
  });

  it("sets client.isConnected to false", async () => {
    expect(testContext.client.isConnected).toBe(true);

    // after disconnect
    await testContext.client.disconnect();
    expect(testContext.client.isConnected).toBe(false);
  });

  it("calls send() on transport adapter", async () => {
    await expect(testContext.client.disconnect()).resolves.toBeUndefined();

    vi.waitFor(() => {
      expect(testContext.transportMock.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createSimplePacketV4(PacketType.DISCONNECT)
      );
    });
  });

  it("calls disconnect() on transport adapter", async () => {
    expect(testContext.client.isConnected).toBe(true);
    expect(testContext.transportMock.disconnect).not.toHaveBeenCalled();

    await testContext.client.disconnect();
    expect(
      testContext.transportMock.disconnect
    ).toHaveBeenCalledExactlyOnceWith();
  });

  it("emits disconnect event when transport emits disconnect event", async () => {
    testContext.transportMock.emit("disconnect", error);

    vi.waitFor(() => {
      expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(error);
    });
  });

  it("emits disconnect event with undefined error when transport emits disconnect event without error", async () => {
    testContext.transportMock.emit("disconnect");

    vi.waitFor(() => {
      expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(undefined);
    });
  });

  it("does not emit disconnect event when transport emits disconnect event after client disconnects", async () => {
    await testContext.client.disconnect();

    expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(undefined);
    disconnectListener.mockReset();

    expect(testContext.client.isConnected).toBe(false);

    testContext.transportMock.emit("disconnect", error);

    vi.waitFor(() => {
      expect(disconnectListener).not.toHaveBeenCalled();
    });
  });

  it("does not emit disconnect event when transport emits disconnect event before calling connect() on client", async () => {
    testContext.client = new MqttClientV4(
      testContext.transportMock,
      testContext.managerMock
    );
    expect(testContext.client.isConnected).toBe(false);

    const disconnectListener = vi.fn();
    testContext.client.on("disconnect", disconnectListener);

    testContext.transportMock.emit("disconnect", error);

    vi.waitFor(() => {
      expect(disconnectListener).not.toHaveBeenCalled();
    });
  });

  it("emits disconnect event when transport emits disconnect event", async () => {
    const disconnectListener = vi.fn();
    const error = new Error("TRANSPORT DISCONNECT");

    testContext.client.on("disconnect", disconnectListener);
    testContext.transportMock.emit("disconnect", error);

    vi.waitFor(() => {
      expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(error);
    });
  });
});
