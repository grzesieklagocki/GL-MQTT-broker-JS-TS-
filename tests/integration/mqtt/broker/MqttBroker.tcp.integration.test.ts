import { once } from "node:events";
import { createConnection, Socket } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MqttBroker } from "@mqtt/broker/MqttBroker";
import { MqttTcpListener } from "@mqtt/broker/MqttTcpListener";
import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { MqttPacketCodecV4 } from "@mqtt/shared/MqttPacketCodecV4";

describe("MqttBroker over TCP", () => {
  const host = "127.0.0.1";
  const clients: Socket[] = [];
  let broker: MqttBroker;
  let listener: MqttTcpListener;
  let port: number;
  let canLogin: ReturnType<typeof vi.fn<() => boolean>>;

  beforeEach(async () => {
    canLogin = vi.fn(() => true);
    broker = new MqttBroker({ canLogin, canSubscribe: () => 2 });

    listener = new MqttTcpListener(host, 0);
    await new Promise<void>((resolve, reject) => {
      const onError = ({ error }: { error: Error }) => reject(error);
      broker.once("brokerError", onError);
      listener.listeningHandler = () => {
        broker.off("brokerError", onError);
        resolve();
      };
      broker.addConnectionListener(listener);
    });

    const address = listener.address;
    if (!address) throw new Error("Expected a TCP address");
    port = address.port;
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) client.destroy();
    await broker.stop();
  });

  async function openClient(): Promise<Socket> {
    const accepted = once(broker, "connection");
    const client = createConnection({ host, port });
    clients.push(client);
    await Promise.all([accepted, once(client, "connect")]);
    return client;
  }

  function sendConnect(client: Socket, clientId: string): void {
    const packet = MqttPacketV4Factory.createConnectPacketV4(true, 0, clientId);
    client.write(new MqttPacketCodecV4().encode(packet));
  }

  it("sends a successful CONNACK for an accepted CONNECT [MQTT-3.1.4-4]", async () => {
    const client = await openClient();
    sendConnect(client, "client");

    const chunks: Buffer[] = [];
    let received = 0;
    for await (const chunk of client.iterator({ destroyOnReturn: false })) {
      chunks.push(chunk);
      received += chunk.length;
      if (received >= 4) break;
    }

    expect(Buffer.concat(chunks)).toEqual(Buffer.from([0x20, 0x02, 0x00, 0x00]));
  });

  it("sends a refusal before closing the TCP connection [MQTT-3.2.2-5]", async () => {
    canLogin.mockReturnValue(false);
    const client = await openClient();
    const chunks: Buffer[] = [];
    client.on("data", (chunk: Buffer) => chunks.push(chunk));
    const closed = once(client, "close");

    sendConnect(client, "client");

    await expect(closed).resolves.toEqual([false]);
    expect(Buffer.concat(chunks)).toEqual(Buffer.from([0x20, 0x02, 0x00, 0x05]));
  });

  it("stops listening and closes both accepted sockets when the broker stops", async () => {
    const first = await openClient();
    const second = await openClient();
    const firstClosed = once(first, "close");
    const secondClosed = once(second, "close");
    first.resume();
    second.resume();

    await broker.stop();

    expect(listener.address).toBeNull();
    await expect(firstClosed).resolves.toEqual([false]);
    await expect(secondClosed).resolves.toEqual([false]);
  });
});
