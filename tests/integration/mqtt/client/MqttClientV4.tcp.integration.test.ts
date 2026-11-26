import { once } from "node:events";
import { createServer, Socket } from "node:net";
import { MqttClientV4 } from "@mqtt/client/v4/client";
import { MqttTransportAdapterFactory } from "@mqtt/shared/MqttTransportAdapterFactory";
import { expect, it, vi } from "vitest";

// MQTT 3.1.1 Table 2.1 and [MQTT-4.8.0-1].
it("closes the TCP connection when the broker sends PINGREQ", async () => {
  const host = "127.0.0.1";
  const server = createServer();
  let peer: Socket | undefined;
  server.on("connection", (socket) => {
    peer = socket;
    // The test peer only needs to reply to the client's CONNECT.
    socket.once("data", () => socket.write(Uint8Array.of(0x20, 2, 0, 0)));
  });

  const listening = once(server, "listening");
  server.listen(0, host);
  await listening;
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Expected TCP address");
    const transport = MqttTransportAdapterFactory.createTcp(
      host,
      address.port,
      "client"
    );
    const client = new MqttClientV4(transport);
    await client.connect("directiontest", undefined, undefined, 0);
    if (!peer) throw new Error("Expected TCP peer");

    const disconnected = vi.fn();
    const closed = vi.fn();
    client.on("disconnect", disconnected);
    peer.on("close", closed);
    peer.resume();
    peer.write(Uint8Array.of(0xc0, 0)); // PINGREQ is client to server only.

    await vi.waitFor(() => {
      expect(closed).toHaveBeenCalledOnce();
      expect(disconnected).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          message: expect.stringMatching(
            /Unsupported Fixed Header Packet Type: 12/
          ),
        })
      );
    });
  } finally {
    peer?.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
