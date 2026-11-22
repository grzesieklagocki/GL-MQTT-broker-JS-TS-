import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MqttBroker } from "@mqtt/broker/MqttBroker";
import { RetainedMessagesManager } from "@mqtt/broker/topics/RetainedMessagesManager";
import { SubscriptionManager } from "@mqtt/broker/topics/SubscriptionManager";
import {
  AcceptedConnection,
  IAuthManager,
  IConnectionListener,
} from "@mqtt/broker/types";
import { PacketType, QoS } from "@mqtt/protocol/shared/types";
import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import {
  ConnackReturnCodeV4,
  SubackReturnCodeV4,
  SubscriptionV4,
} from "@mqtt/protocol/v4/types";

describe("MqttBroker", () => {
  let broker: MqttBroker;
  let listenerMock: IConnectionListener;
  let secondListenerMock: IConnectionListener;
  let connectionMock: AcceptedConnection;
  let authManagerMock: IAuthManager;
  let subscriptionManager: SubscriptionManager;
  let retainedMessages: RetainedMessagesManager;

  const createListenerMock = (): IConnectionListener => ({
    listen: vi.fn(),
    stop: vi.fn(async () => {}),
    connectionHandler: vi.fn(),
    closeHandler: vi.fn(),
  });

  const createConnectionMock = (info: string): AcceptedConnection => ({
    info,
    transport: {
      send: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
      packetReceivedHandler: vi.fn(),
      disconnectHandler: vi.fn(),
    },
  });

  const createAuthManagerMock = (): IAuthManager => ({
    canLogin: vi.fn(() => true),
    canSubscribe: vi.fn(() => 2 as QoS),
  });

  beforeEach(() => {
    authManagerMock = createAuthManagerMock();
    subscriptionManager = new SubscriptionManager();
    retainedMessages = new RetainedMessagesManager();
    broker = new MqttBroker(authManagerMock, subscriptionManager, retainedMessages);
    listenerMock = createListenerMock();
    secondListenerMock = createListenerMock();
    connectionMock = createConnectionMock("test connection");
  });

  describe("method", () => {
    describe("addConnectionListener()", () => {
      it("calls listen() once when a listener is added", () => {
        broker.addConnectionListener(listenerMock);

        expect(listenerMock.listen).toHaveBeenCalledExactlyOnceWith();
        expect(listenerMock.stop).not.toHaveBeenCalled();
      });

      it("handles connections accepted synchronously during listen()", () => {
        const connectionListener = vi.fn();
        broker.on("connection", connectionListener);
        vi.mocked(listenerMock.listen).mockImplementation(() => {
          listenerMock.connectionHandler(connectionMock);
        });

        broker.addConnectionListener(listenerMock);

        expect(connectionListener).toHaveBeenCalledExactlyOnceWith({
          connectionId: expect.any(Number),
          connectionInfo: connectionMock.info,
        });
      });

      it("rejects adding the same listener twice without restarting it or replacing its handlers", () => {
        broker.addConnectionListener(listenerMock);
        const connectionHandler = listenerMock.connectionHandler;
        const closeHandler = listenerMock.closeHandler;

        expect(() => broker.addConnectionListener(listenerMock)).toThrow();

        expect(listenerMock.listen).toHaveBeenCalledExactlyOnceWith();
        expect(listenerMock.connectionHandler).toBe(connectionHandler);
        expect(listenerMock.closeHandler).toBe(closeHandler);
      });

      it("rethrows an error from listen()", () => {
        const error = new Error("Listen failed");
        vi.mocked(listenerMock.listen).mockImplementationOnce(() => {
          throw error;
        });

        expect(() => broker.addConnectionListener(listenerMock)).toThrow(error);
        expect(listenerMock.listen).toHaveBeenCalledExactlyOnceWith();
      });

      it("allows adding a listener again after listen() fails", () => {
        const error = new Error("Listen failed");
        vi.mocked(listenerMock.listen).mockImplementationOnce(() => {
          throw error;
        });
        expect(() => broker.addConnectionListener(listenerMock)).toThrow(error);

        expect(() => broker.addConnectionListener(listenerMock)).not.toThrow();

        expect(listenerMock.listen).toHaveBeenCalledTimes(2);
      });

      it("allows adding a listener again if it closes synchronously during listen()", () => {
        vi.mocked(listenerMock.listen).mockImplementationOnce(() => {
          listenerMock.closeHandler();
        });
        broker.addConnectionListener(listenerMock);

        expect(() => broker.addConnectionListener(listenerMock)).not.toThrow();

        expect(listenerMock.listen).toHaveBeenCalledTimes(2);
      });

      it("starts two different listeners independently", () => {
        broker.addConnectionListener(listenerMock);
        broker.addConnectionListener(secondListenerMock);

        expect(listenerMock.listen).toHaveBeenCalledExactlyOnceWith();
        expect(secondListenerMock.listen).toHaveBeenCalledExactlyOnceWith();
      });

      it("keeps the first listener accepting connections when the second listener fails to start", () => {
        const error = new Error("Listen failed");
        const connectionListener = vi.fn();

        broker.on("connection", connectionListener);
        broker.addConnectionListener(listenerMock);

        vi.mocked(secondListenerMock.listen).mockImplementationOnce(() => {
          throw error;
        });

        expect(() => broker.addConnectionListener(secondListenerMock)).toThrow(
          error
        );

        listenerMock.connectionHandler(connectionMock);

        expect(connectionListener).toHaveBeenCalledExactlyOnceWith({
          connectionId: expect.any(Number),
          connectionInfo: connectionMock.info,
        });
        expect(listenerMock.stop).not.toHaveBeenCalled();
      });
    });

    describe("stop()", () => {
      it("stops all listeners and closes their connections without waiting for listeners first", async () => {
        const secondConnection = createConnectionMock("second connection");
        const closeListener = vi.fn();
        broker.on("connectionClosed", closeListener);
        broker.addConnectionListener(listenerMock);
        broker.addConnectionListener(secondListenerMock);
        listenerMock.connectionHandler(connectionMock);
        secondListenerMock.connectionHandler(secondConnection);

        let finishListenerStop!: () => void;
        vi.mocked(listenerMock.stop).mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              finishListenerStop = resolve;
            })
        );
        vi.mocked(connectionMock.transport.disconnect).mockImplementation(
          async () => {
            connectionMock.transport.disconnectHandler();
            finishListenerStop();
          }
        );
        vi.mocked(secondConnection.transport.disconnect).mockImplementation(
          async () => {
            secondConnection.transport.disconnectHandler();
          }
        );

        const stopped = broker.stop();
        expect(broker.stop()).toBe(stopped);
        await stopped;

        expect(broker.stop()).toBe(stopped);
        expect(listenerMock.stop).toHaveBeenCalledTimes(1);
        expect(secondListenerMock.stop).toHaveBeenCalledTimes(1);
        expect(connectionMock.transport.disconnect).toHaveBeenCalledTimes(1);
        expect(secondConnection.transport.disconnect).toHaveBeenCalledTimes(1);
        expect(closeListener).toHaveBeenCalledTimes(2);
        expect(closeListener).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ reason: "broker-stop" })
        );
        expect(closeListener).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ reason: "broker-stop" })
        );
      });

      it("rejects new listeners and waits for the listener to close", async () => {
        broker.addConnectionListener(listenerMock);
        let finishListenerStop!: () => void;
        vi.mocked(listenerMock.stop).mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              finishListenerStop = resolve;
            })
        );

        const onStopped = vi.fn();
        const stopped = broker.stop().then(onStopped);
        expect(() =>
          broker.addConnectionListener(secondListenerMock)
        ).toThrow();
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(listenerMock.stop).toHaveBeenCalledTimes(1);
        expect(onStopped).not.toHaveBeenCalled();
        finishListenerStop();
        await stopped;

        expect(onStopped).toHaveBeenCalledTimes(1);
        expect(() =>
          broker.addConnectionListener(secondListenerMock)
        ).toThrow();
        expect(secondListenerMock.listen).not.toHaveBeenCalled();
      });

      it("reports a stop failure only after the other resources finish", async () => {
        const error = new Error("Listener stop failed");
        broker.addConnectionListener(listenerMock);
        broker.addConnectionListener(secondListenerMock);
        secondListenerMock.connectionHandler(connectionMock);
        vi.mocked(listenerMock.stop).mockImplementation(() => {
          throw error;
        });
        let finishDisconnect!: () => void;
        vi.mocked(connectionMock.transport.disconnect).mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              finishDisconnect = resolve;
            })
        );

        const onRejected = vi.fn();
        const stopped = broker.stop().catch(onRejected);
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(secondListenerMock.stop).toHaveBeenCalledTimes(1);
        expect(onRejected).not.toHaveBeenCalled();
        finishDisconnect();
        await stopped;

        expect(onRejected).toHaveBeenCalledExactlyOnceWith(error);
      });

      it("reports a transport failure after the listener finishes stopping", async () => {
        const error = new Error("Disconnect failed");
        broker.addConnectionListener(listenerMock);
        listenerMock.connectionHandler(connectionMock);
        let finishListenerStop!: () => void;
        vi.mocked(listenerMock.stop).mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              finishListenerStop = resolve;
            })
        );
        vi.mocked(connectionMock.transport.disconnect).mockRejectedValue(error);

        const onRejected = vi.fn();
        const stopped = broker.stop().catch(onRejected);
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(connectionMock.transport.disconnect).toHaveBeenCalledTimes(1);
        expect(onRejected).not.toHaveBeenCalled();
        finishListenerStop();
        await stopped;

        expect(onRejected).toHaveBeenCalledExactlyOnceWith(error);
      });
    });
  });

  describe("on listener event", () => {
    describe("connection", () => {
      it("accepts connections from both listeners", () => {
        const connectionListener = vi.fn();
        const secondConnection = createConnectionMock("second connection");

        broker.on("connection", connectionListener);
        broker.addConnectionListener(listenerMock);
        broker.addConnectionListener(secondListenerMock);

        listenerMock.connectionHandler(connectionMock);
        secondListenerMock.connectionHandler(secondConnection);

        expect(connectionListener).toHaveBeenCalledTimes(2);
        expect(connectionListener).toHaveBeenNthCalledWith(1, {
          connectionId: expect.any(Number),
          connectionInfo: connectionMock.info,
        });
        expect(connectionListener).toHaveBeenNthCalledWith(2, {
          connectionId: expect.any(Number),
          connectionInfo: secondConnection.info,
        });
        expect(connectionListener.mock.calls[0][0].connectionId).not.toBe(
          connectionListener.mock.calls[1][0].connectionId
        );
      });
    });

    describe("close", () => {
      it("allows adding a closed listener again", () => {
        broker.addConnectionListener(listenerMock);
        listenerMock.closeHandler();

        expect(() => broker.addConnectionListener(listenerMock)).not.toThrow();

        expect(listenerMock.listen).toHaveBeenCalledTimes(2);
      });

      it("does not stop another listener or close accepted connections", () => {
        const connectionListener = vi.fn();

        broker.on("connection", connectionListener);
        broker.addConnectionListener(listenerMock);
        broker.addConnectionListener(secondListenerMock);
        listenerMock.connectionHandler(connectionMock);

        listenerMock.closeHandler();
        secondListenerMock.connectionHandler(
          createConnectionMock("second connection")
        );

        expect(connectionListener).toHaveBeenCalledTimes(2);
        expect(secondListenerMock.stop).not.toHaveBeenCalled();
        expect(connectionMock.transport.disconnect).not.toHaveBeenCalled();
      });

      it("reports a listener error through brokerError", () => {
        const error = new Error("Listener failed");
        const errorListener = vi.fn();

        broker.on("brokerError", errorListener);
        broker.addConnectionListener(listenerMock);

        listenerMock.closeHandler(error);

        expect(errorListener).toHaveBeenCalledExactlyOnceWith({
          source: "network-listener",
          error,
        });
      });
    });
  });

  describe("on transport packet", () => {
    const password = new Uint8Array([0, 255]);
    let connectionId: number;

    beforeEach(() => {
      broker.addConnectionListener(listenerMock);
      broker.once("connection", (event) => {
        connectionId = event.connectionId;
      });
      listenerMock.connectionHandler(connectionMock);
    });

    it("emits clientConnected only after sending a successful CONNACK", async () => {
      const clientId = "client";
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true,
        0,
        clientId
      );
      const { transport } = connectionMock;
      const clientConnectedListener = vi.fn();
      broker.on("clientConnected", clientConnectedListener);
      let finishSend!: () => void;
      vi.mocked(transport.send).mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finishSend = resolve;
        })
      );

      transport.packetReceivedHandler(packet);
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(transport.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createConnackPacketV4(false)
      );
      expect(clientConnectedListener).not.toHaveBeenCalled();

      finishSend();
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(clientConnectedListener).toHaveBeenCalledExactlyOnceWith({
        connectionId,
        clientId,
      });
    });

    it.each([
      {
        name: "anonymous client",
        userName: undefined,
        password: undefined,
        auth: undefined,
      },
      {
        name: "username only",
        userName: "user",
        password: undefined,
        auth: { user: "user" },
      },
      {
        name: "username and password",
        userName: "user",
        password,
        auth: { user: "user", password },
      },
      {
        name: "empty username",
        userName: "",
        password,
        auth: { user: "", password },
      },
    ])("accepts CONNECT with $name", ({ userName, password, auth }) => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true,
        0,
        "client",
        userName,
        password
      );
      const { transport } = connectionMock;

      transport.packetReceivedHandler(packet);

      expect(authManagerMock.canLogin).toHaveBeenCalledExactlyOnceWith(auth);
      expect(transport.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createConnackPacketV4(false)
      );
      expect(transport.disconnect).not.toHaveBeenCalled();
    });

    it.each(["A", "a".repeat(23)])(
      "accepts ClientId %j at the length boundary",
      (clientId) => {
        const packet = MqttPacketV4Factory.createConnectPacketV4(
          true,
          0,
          clientId
        );

        connectionMock.transport.packetReceivedHandler(packet);

        expect(connectionMock.transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(false)
        );
      }
    );

    it("reports no existing session on the first CONNECT with CleanSession disabled", () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        false,
        0,
        "client"
      );

      connectionMock.transport.packetReceivedHandler(packet);

      expect(connectionMock.transport.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createConnackPacketV4(false)
      );
    });

    describe("session lifecycle", () => {
      const clientId = "client";

      function reconnect(cleanSession: boolean, id = clientId) {
        const connection = createConnectionMock("new connection");
        listenerMock.connectionHandler(connection);
        connection.transport.packetReceivedHandler(
          MqttPacketV4Factory.createConnectPacketV4(cleanSession, 0, id)
        );
        return connection.transport;
      }

      async function connectAndClose(cleanSession: boolean): Promise<void> {
        const { transport } = connectionMock;
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createConnectPacketV4(cleanSession, 0, clientId)
        );
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(false)
        );
        transport.disconnectHandler();
      }

      // Even an empty session must be kept after disconnect [MQTT-3.1.2-4].
      it("reports an existing empty session when the same client reconnects", async () => {
        await connectAndClose(false);

        const transport = reconnect(false);

        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(true)
        );
      });

      it("does not report a stored session for a different ClientId", async () => {
        await connectAndClose(false);

        const transport = reconnect(false, "other");

        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(false)
        );
      });

      // A clean session lasts only as long as its connection [MQTT-3.1.2-6].
      it("does not keep a clean session after the connection closes", async () => {
        await connectAndClose(true);

        const transport = reconnect(false);

        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(false)
        );
      });

      it("discards a stored session when the client reconnects with CleanSession enabled", async () => {
        await connectAndClose(false);

        const resumedTransport = reconnect(false);
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(resumedTransport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(true)
        );
        resumedTransport.disconnectHandler();

        const cleanTransport = reconnect(true);
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(cleanTransport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(false)
        );
        cleanTransport.disconnectHandler();

        const transport = reconnect(false);

        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(false)
        );
      });
    });

    describe("active client replacement", () => {
      const clientId = "client";

      async function connectFirstClient(cleanSession: boolean) {
        const { transport } = connectionMock;
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createConnectPacketV4(cleanSession, 0, clientId)
        );
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(false)
        );
        return transport;
      }

      function connectSecondClient() {
        const connection = createConnectionMock("replacement connection");
        listenerMock.connectionHandler(connection);
        connection.transport.packetReceivedHandler(
          MqttPacketV4Factory.createConnectPacketV4(false, 0, clientId)
        );
        return connection.transport;
      }

      // Disconnect the existing client before applying CleanSession and sending CONNACK.
      // See [MQTT-3.1.4-2] through [MQTT-3.1.4-4].
      it.each([
        { session: "stored", cleanSession: false, sessionPresent: true },
        { session: "clean", cleanSession: true, sessionPresent: false },
      ])(
        "closes the active connection with a $session session before acknowledging its replacement",
        async ({ cleanSession, sessionPresent }) => {
          const first = await connectFirstClient(cleanSession);
          let finishDisconnect!: () => void;
          vi.mocked(first.disconnect).mockReturnValueOnce(
            new Promise<void>((resolve) => {
              finishDisconnect = resolve;
            })
          );

          const second = connectSecondClient();
          await new Promise<void>((resolve) => setImmediate(resolve));

          expect(first.disconnect).toHaveBeenCalledTimes(1);
          expect(second.send).not.toHaveBeenCalled();

          first.disconnectHandler();
          finishDisconnect();
          await new Promise<void>((resolve) => setImmediate(resolve));

          expect(second.send).toHaveBeenCalledExactlyOnceWith(
            MqttPacketV4Factory.createConnackPacketV4(sessionPresent)
          );
          expect(second.disconnect).not.toHaveBeenCalled();
        }
      );

      it("does not disconnect the active client if the replacement is not authorized", async () => {
        const first = await connectFirstClient(false);
        vi.mocked(authManagerMock.canLogin).mockReturnValueOnce(false);

        const second = connectSecondClient();
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(second.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(
            false,
            ConnackReturnCodeV4.CONNECTION_REFUSED_NOT_AUTHORIZED
          )
        );
        expect(second.disconnect).toHaveBeenCalledTimes(1);
        expect(first.disconnect).not.toHaveBeenCalled();
      });
    });

    it("sends a refusal before closing the transport when login is denied", async () => {
      vi.mocked(authManagerMock.canLogin).mockReturnValue(false);
      const clientConnectedListener = vi.fn();
      broker.on("clientConnected", clientConnectedListener);
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true,
        0,
        "client"
      );
      const { transport } = connectionMock;

      transport.packetReceivedHandler(packet);
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(authManagerMock.canLogin).toHaveBeenCalledExactlyOnceWith(
        undefined
      );
      expect(transport.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createConnackPacketV4(
          false,
          ConnackReturnCodeV4.CONNECTION_REFUSED_NOT_AUTHORIZED
        )
      );
      expect(transport.disconnect).toHaveBeenCalledTimes(1);
      expect(
        vi.mocked(transport.send).mock.invocationCallOrder[0]
      ).toBeLessThan(
        vi.mocked(transport.disconnect).mock.invocationCallOrder[0]
      ); // check that send was called before disconnect
      expect(clientConnectedListener).not.toHaveBeenCalled();
    });

    // If the broker rejects a ClientId, it must send 0x02 and close [MQTT-3.1.3-9].
    it.each([
      {
        name: "a 24-byte ClientId",
        clientId: "a".repeat(24),
        cleanSession: true,
      },
      {
        name: "a ClientId with a hyphen",
        clientId: "sensor-1",
        cleanSession: true,
      },
      {
        name: "an empty ClientId with CleanSession enabled",
        clientId: "",
        cleanSession: true,
      },
      {
        name: "an empty ClientId with CleanSession disabled",
        clientId: "",
        cleanSession: false,
      },
    ])(
      "sends a refusal before closing the transport for $name",
      async ({ clientId, cleanSession }) => {
        const clientConnectedListener = vi.fn();
        broker.on("clientConnected", clientConnectedListener);
        const packet = MqttPacketV4Factory.createConnectPacketV4(
          cleanSession,
          0,
          clientId
        );
        const { transport } = connectionMock;

        transport.packetReceivedHandler(packet);
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(authManagerMock.canLogin).not.toHaveBeenCalled();
        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(
            false,
            ConnackReturnCodeV4.CONNECTION_REFUSED_IDENTIFIER_REJECTED
          )
        );
        expect(transport.disconnect).toHaveBeenCalledTimes(1);
        expect(
          vi.mocked(transport.send).mock.invocationCallOrder[0]
        ).toBeLessThan(
          vi.mocked(transport.disconnect).mock.invocationCallOrder[0]
        );
        expect(clientConnectedListener).not.toHaveBeenCalled();
      }
    );

    it("closes the transport without CONNACK if the first packet is not CONNECT", async () => {
      const packet = MqttPacketV4Factory.createSimplePacketV4(
        PacketType.PINGREQ
      );
      const { transport } = connectionMock;

      transport.packetReceivedHandler(packet);
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(authManagerMock.canLogin).not.toHaveBeenCalled();
      expect(transport.send).not.toHaveBeenCalled();
      expect(transport.disconnect).toHaveBeenCalledTimes(1);
    });

    describe("after an accepted CONNECT", () => {
      beforeEach(async () => {
        const { transport } = connectionMock;
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createConnectPacketV4(false, 0, "client")
        );
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(false)
        );
        vi.mocked(transport.send).mockClear();
      });

      it("answers PINGREQ with PINGRESP without closing the transport", async () => {
        const { transport } = connectionMock;
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createSimplePacketV4(PacketType.PINGREQ)
        );
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createSimplePacketV4(PacketType.PINGRESP)
        );
        expect(transport.disconnect).not.toHaveBeenCalled();
      });

      it("closes the transport without a response or error on DISCONNECT", async () => {
        const { transport } = connectionMock;
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createSimplePacketV4(PacketType.DISCONNECT)
        );
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(transport.disconnect).toHaveBeenCalledExactlyOnceWith();
        expect(transport.send).not.toHaveBeenCalled();
      });

      it("closes the transport with the original error if sending PINGRESP fails", async () => {
        const { transport } = connectionMock;
        const error = new Error("PINGRESP send failed");
        const failedSend = Promise.reject(error);
        // Keep the rejection observed by Vitest even when the broker ignores it.
        void failedSend.catch(() => {});
        vi.mocked(transport.send).mockReturnValueOnce(failedSend);

        transport.packetReceivedHandler(
          MqttPacketV4Factory.createSimplePacketV4(PacketType.PINGREQ)
        );
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createSimplePacketV4(PacketType.PINGRESP)
        );
        expect(transport.disconnect).toHaveBeenCalledExactlyOnceWith(error);
      });

      it("ignores packets delivered while a DISCONNECT is closing the transport", async () => {
        const { transport } = connectionMock;
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createSimplePacketV4(PacketType.DISCONNECT)
        );
        // The mock has not reported transport closure yet.
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createSimplePacketV4(PacketType.PINGREQ)
        );
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(transport.disconnect).toHaveBeenCalledExactlyOnceWith();
        expect(transport.send).not.toHaveBeenCalled();
      });
    });

    describe("SUBSCRIBE", () => {
      async function connectSubscriber(cleanSession = false) {
        const { transport } = connectionMock;
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createConnectPacketV4(cleanSession, 0, "client")
        );
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(false)
        );
        vi.mocked(transport.send).mockClear();
        return transport;
      }

      it.each<{
        name: string;
        subscriptions: SubscriptionV4[];
        returnCodes: SubackReturnCodeV4[];
      }>([
        {
          name: "one topic filter",
          subscriptions: [["home/temperature", 0]],
          returnCodes: [SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0],
        },
        {
          name: "multiple topic filters in request order",
          subscriptions: [
            ["home/+/temperature", 1],
            ["home/light", 0],
          ],
          returnCodes: [
            SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
            SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
          ],
        },
      ])(
        "sends one SUBACK for $name",
        async ({ subscriptions, returnCodes }) => {
          const transport = await connectSubscriber();

          const identifier = 42;
          transport.packetReceivedHandler(
            MqttPacketV4Factory.createSubscribePacketV4(
              identifier,
              subscriptions
            )
          );
          await new Promise<void>((resolve) => setImmediate(resolve));

          expect(transport.send).toHaveBeenCalledExactlyOnceWith(
            MqttPacketV4Factory.createSubackPacketV4(identifier, returnCodes)
          );
          expect(transport.disconnect).not.toHaveBeenCalled();
        }
      );

      it("stores only allowed filters with the granted QoS under the ClientId", async () => {
        const transport = await connectSubscriber();
        vi.mocked(authManagerMock.canSubscribe)
          .mockReturnValueOnce(1)
          .mockReturnValueOnce(false);

        transport.packetReceivedHandler(
          MqttPacketV4Factory.createSubscribePacketV4(42, [
            ["home/+/temperature", 2],
            ["home/secret", 1],
          ])
        );
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createSubackPacketV4(42, [
            SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
            SubackReturnCodeV4.FAILURE,
          ])
        );
        expect(
          subscriptionManager.getSubscribers("home/kitchen/temperature")
        ).toEqual([{ clientId: "client", qos: 1 }]);
        expect(subscriptionManager.getSubscribers("home/secret")).toEqual([]);
      });

      it("accepts QoS 0 as an authorization limit rather than a denial", async () => {
        const transport = await connectSubscriber();
        vi.mocked(authManagerMock.canSubscribe).mockReturnValueOnce(0);

        transport.packetReceivedHandler(
          MqttPacketV4Factory.createSubscribePacketV4(42, [["home/light", 1]])
        );
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createSubackPacketV4(42, [
            SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
          ])
        );
        expect(subscriptionManager.getSubscribers("home/light")).toEqual([
          { clientId: "client", qos: 0 },
        ]);
      });

      async function subscribeToLight(transport: AcceptedConnection["transport"]) {
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createSubscribePacketV4(42, [["home/light", 0]])
        );
        await new Promise<void>((resolve) => setImmediate(resolve));
      }

      it("removes subscriptions when a clean session closes", async () => {
        const transport = await connectSubscriber(true);
        await subscribeToLight(transport);
        expect(subscriptionManager.getSubscribers("home/light")).toEqual([
          { clientId: "client", qos: 0 },
        ]);

        transport.disconnectHandler();

        expect(subscriptionManager.getSubscribers("home/light")).toEqual([]);
      });

      it("keeps subscriptions offline until a clean reconnect discards them", async () => {
        const transport = await connectSubscriber();
        await subscribeToLight(transport);
        transport.disconnectHandler();
        expect(subscriptionManager.getSubscribers("home/light")).toEqual([
          { clientId: "client", qos: 0 },
        ]);

        const replacement = createConnectionMock("clean reconnect");
        listenerMock.connectionHandler(replacement);
        replacement.transport.packetReceivedHandler(
          MqttPacketV4Factory.createConnectPacketV4(true, 0, "client")
        );
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(replacement.transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(false)
        );
        expect(subscriptionManager.getSubscribers("home/light")).toEqual([]);
      });

      it("handles SUBSCRIBE received during takeover after sending CONNACK", async () => {
        const first = await connectSubscriber();
        let finishDisconnect!: () => void;
        vi.mocked(first.disconnect).mockReturnValueOnce(
          new Promise<void>((resolve) => {
            finishDisconnect = resolve;
          })
        );
        const replacement = createConnectionMock("replacement connection");
        listenerMock.connectionHandler(replacement);
        const second = replacement.transport;
        second.packetReceivedHandler(
          MqttPacketV4Factory.createConnectPacketV4(false, 0, "client")
        );
        await subscribeToLight(second);

        first.disconnectHandler();
        finishDisconnect();
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(second.send).toHaveBeenCalledTimes(2);
        expect(second.send).toHaveBeenNthCalledWith(
          1,
          MqttPacketV4Factory.createConnackPacketV4(true)
        );
        expect(second.send).toHaveBeenNthCalledWith(
          2,
          MqttPacketV4Factory.createSubackPacketV4(42, [
            SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
          ])
        );
        expect(subscriptionManager.getSubscribers("home/light")).toEqual([
          { clientId: "client", qos: 0 },
        ]);
      });

      it("closes the transport with the original error if sending SUBACK fails", async () => {
        const transport = await connectSubscriber();
        const error = new Error("SUBACK send failed");
        const failedSend = Promise.reject(error);
        // Prevent an unhandled rejection from masking the assertion on disconnect.
        void failedSend.catch(() => {});
        vi.mocked(transport.send).mockReturnValueOnce(failedSend);

        transport.packetReceivedHandler(
          MqttPacketV4Factory.createSubscribePacketV4(42, [["home/light", 0]])
        );
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createSubackPacketV4(42, [
            SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
          ])
        );
        expect(transport.disconnect).toHaveBeenCalledExactlyOnceWith(error);
      });
    });

    it("forwards a QoS 0 publication to a matching subscriber", async () => {
      const subscriber = connectionMock.transport;
      const publisherConnection = createConnectionMock("publisher connection");
      listenerMock.connectionHandler(publisherConnection);
      const publisher = publisherConnection.transport;

      subscriber.packetReceivedHandler(
        MqttPacketV4Factory.createConnectPacketV4(true, 0, "subscriber")
      );
      publisher.packetReceivedHandler(
        MqttPacketV4Factory.createConnectPacketV4(true, 0, "publisher")
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      const connack = MqttPacketV4Factory.createConnackPacketV4(false);
      expect(subscriber.send).toHaveBeenCalledExactlyOnceWith(connack);
      expect(publisher.send).toHaveBeenCalledExactlyOnceWith(connack);
      vi.mocked(subscriber.send).mockClear();
      vi.mocked(publisher.send).mockClear();

      subscriber.packetReceivedHandler(
        MqttPacketV4Factory.createSubscribePacketV4(42, [
          ["home/+/temperature", 0],
        ])
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(subscriber.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createSubackPacketV4(42, [
          SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
        ])
      );
      vi.mocked(subscriber.send).mockClear();

      const publication = MqttPacketV4Factory.createPublishPacketV4(
        "home/kitchen/temperature",
        new Uint8Array([0, 22, 255])
      );
      publisher.packetReceivedHandler(publication);
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(subscriber.send).toHaveBeenCalledExactlyOnceWith(publication);
      expect(publisher.send).not.toHaveBeenCalled();
      expect(publisher.disconnect).not.toHaveBeenCalled();
    });

    it("closes only the subscriber transport when forwarding PUBLISH fails", async () => {
      const subscriber = connectionMock.transport;
      const publisherConnection = createConnectionMock("publisher connection");
      listenerMock.connectionHandler(publisherConnection);
      const publisher = publisherConnection.transport;

      subscriber.packetReceivedHandler(
        MqttPacketV4Factory.createConnectPacketV4(true, 0, "subscriber")
      );
      publisher.packetReceivedHandler(
        MqttPacketV4Factory.createConnectPacketV4(true, 0, "publisher")
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      subscriptionManager.subscribe("subscriber", "home/light", 0);
      vi.mocked(subscriber.send).mockClear();

      const error = new Error("PUBLISH send failed");
      const failedSend = Promise.reject(error);
      // Keep an ignored rejection from masking the disconnect assertion.
      void failedSend.catch(() => {});
      vi.mocked(subscriber.send).mockReturnValueOnce(failedSend);

      const publication = MqttPacketV4Factory.createPublishPacketV4(
        "home/light",
        new Uint8Array([1])
      );
      publisher.packetReceivedHandler(publication);
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(subscriber.send).toHaveBeenCalledExactlyOnceWith(publication);
      expect(subscriber.disconnect).toHaveBeenCalledExactlyOnceWith(error);
      expect(publisher.disconnect).not.toHaveBeenCalled();
    });

    it("does not forward PUBLISH to a subscriber whose transport is closing", async () => {
      const subscriber = connectionMock.transport;
      const publisherConnection = createConnectionMock("publisher connection");
      listenerMock.connectionHandler(publisherConnection);
      const publisher = publisherConnection.transport;

      subscriber.packetReceivedHandler(
        MqttPacketV4Factory.createConnectPacketV4(true, 0, "subscriber")
      );
      publisher.packetReceivedHandler(
        MqttPacketV4Factory.createConnectPacketV4(true, 0, "publisher")
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      subscriber.packetReceivedHandler(
        MqttPacketV4Factory.createSubscribePacketV4(42, [["home/light", 0]])
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(subscriber.send).toHaveBeenNthCalledWith(
        2,
        MqttPacketV4Factory.createSubackPacketV4(42, [
          SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
        ])
      );
      vi.mocked(subscriber.send).mockClear();

      subscriber.packetReceivedHandler(
        MqttPacketV4Factory.createSimplePacketV4(PacketType.DISCONNECT)
      );
      expect(subscriber.disconnect).toHaveBeenCalledExactlyOnceWith();
      // The transport has not reported closure yet.
      publisher.packetReceivedHandler(
        MqttPacketV4Factory.createPublishPacketV4("home/light", new Uint8Array([1]))
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(subscriber.send).not.toHaveBeenCalled();
      expect(publisher.disconnect).not.toHaveBeenCalled();
    });

    describe("UNSUBSCRIBE", () => {
      it.each([
        {
          name: "removes only the requested filters",
          filters: ["home/+", "garden/light"],
          remainingHomeSubscribers: [],
          remainingGardenSubscribers: [],
        },
        {
          name: "keeps subscriptions when no filter matches exactly",
          filters: ["home/light", "unknown"],
          remainingHomeSubscribers: [{ clientId: "client", qos: 0 }],
          remainingGardenSubscribers: [{ clientId: "client", qos: 0 }],
        },
      ])("$name and sends one UNSUBACK", async ({
        filters,
        remainingHomeSubscribers,
        remainingGardenSubscribers,
      }) => {
        const { transport } = connectionMock;
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createConnectPacketV4(false, 0, "client")
        );
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(false)
        );
        vi.mocked(transport.send).mockClear();
        subscriptionManager.subscribe("client", "home/+", 0);
        subscriptionManager.subscribe("client", "garden/light", 0);
        subscriptionManager.subscribe("client", "office/light", 0);

        const identifier = 43;
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createUnsubscribePacketV4(identifier, filters)
        );
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createPacketWithIdentifierV4(
            PacketType.UNSUBACK,
            identifier
          )
        );
        expect(subscriptionManager.getSubscribers("home/light")).toEqual(
          remainingHomeSubscribers
        );
        expect(subscriptionManager.getSubscribers("garden/light")).toEqual(
          remainingGardenSubscribers
        );
        expect(subscriptionManager.getSubscribers("office/light")).toEqual([
          { clientId: "client", qos: 0 },
        ]);
        expect(transport.disconnect).not.toHaveBeenCalled();
      });
    });

    it("closes the transport with the original error if sending UNSUBACK fails", async () => {
      const { transport } = connectionMock;
      transport.packetReceivedHandler(
        MqttPacketV4Factory.createConnectPacketV4(false, 0, "client")
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      vi.mocked(transport.send).mockClear();

      const error = new Error("UNSUBACK send failed");
      const failedSend = Promise.reject(error);
      // Keep an ignored rejection from masking the disconnect assertion.
      void failedSend.catch(() => {});
      vi.mocked(transport.send).mockReturnValueOnce(failedSend);

      const identifier = 43;
      transport.packetReceivedHandler(
        MqttPacketV4Factory.createUnsubscribePacketV4(identifier, ["home/light"])
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(transport.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createPacketWithIdentifierV4(
          PacketType.UNSUBACK,
          identifier
        )
      );
      expect(transport.disconnect).toHaveBeenCalledExactlyOnceWith(error);
    });

    it("delivers a retained QoS 0 publication to a new matching subscriber", async () => {
      const publisher = connectionMock.transport;
      publisher.packetReceivedHandler(
        MqttPacketV4Factory.createConnectPacketV4(true, 0, "publisher")
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(publisher.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createConnackPacketV4(false)
      );
      vi.mocked(publisher.send).mockClear();

      const publication = MqttPacketV4Factory.createPublishPacketV4(
        "home/kitchen/temperature",
        new Uint8Array([22]),
        MqttPacketV4Factory.createPublishFlagsV4(0, true)
      );
      publisher.packetReceivedHandler(publication);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(publisher.send).not.toHaveBeenCalled();
      expect(publisher.disconnect).not.toHaveBeenCalled();

      const subscriberConnection = createConnectionMock("subscriber connection");
      listenerMock.connectionHandler(subscriberConnection);
      const subscriber = subscriberConnection.transport;
      subscriber.packetReceivedHandler(
        MqttPacketV4Factory.createConnectPacketV4(true, 0, "subscriber")
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(subscriber.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createConnackPacketV4(false)
      );
      vi.mocked(subscriber.send).mockClear();

      subscriber.packetReceivedHandler(
        MqttPacketV4Factory.createSubscribePacketV4(42, [
          ["home/+/temperature", 0],
        ])
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      // MQTT permits PUBLISH before SUBACK for a new subscription.
      expect(subscriber.send).toHaveBeenCalledWith(
        MqttPacketV4Factory.createSubackPacketV4(42, [
          SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
        ])
      );
      expect(subscriber.send).toHaveBeenCalledWith(publication);
      expect(subscriber.send).toHaveBeenCalledTimes(2);
    });

    it("clears a retained message on an empty retained PUBLISH", async () => {
      const { transport } = connectionMock;
      const topic = "home/light";
      transport.packetReceivedHandler(
        MqttPacketV4Factory.createConnectPacketV4(true, 0, "client")
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      vi.mocked(transport.send).mockClear();
      retainedMessages.set(topic, new Uint8Array([1]), 0);

      transport.packetReceivedHandler(
        MqttPacketV4Factory.createPublishPacketV4(
          topic,
          new Uint8Array(),
          MqttPacketV4Factory.createPublishFlagsV4(0, true)
        )
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      transport.packetReceivedHandler(
        MqttPacketV4Factory.createSubscribePacketV4(42, [[topic, 0]])
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(transport.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createSubackPacketV4(42, [
          SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
        ])
      );
    });

    it("limits retained delivery to the granted subscription QoS", async () => {
      const { transport } = connectionMock;
      const topic = "home/light";
      const payload = new Uint8Array([1]);
      transport.packetReceivedHandler(
        MqttPacketV4Factory.createConnectPacketV4(true, 0, "client")
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      vi.mocked(transport.send).mockClear();
      // Seed the store without relying on incoming QoS 1 handling.
      retainedMessages.set(topic, payload, 1);
      vi.mocked(authManagerMock.canSubscribe).mockReturnValueOnce(0);

      transport.packetReceivedHandler(
        MqttPacketV4Factory.createSubscribePacketV4(42, [[topic, 1]])
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(transport.send).toHaveBeenCalledWith(
        MqttPacketV4Factory.createSubackPacketV4(42, [
          SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_0,
        ])
      );
      expect(transport.send).toHaveBeenCalledWith(
        MqttPacketV4Factory.createPublishPacketV4(
          topic,
          payload,
          MqttPacketV4Factory.createPublishFlagsV4(0, true)
        )
      );
    });

    it("does not raise retained QoS to the granted subscription QoS", async () => {
      const { transport } = connectionMock;
      const topic = "home/light";
      const payload = new Uint8Array([1]);
      retainedMessages.set(topic, payload, 0);

      transport.packetReceivedHandler(
        MqttPacketV4Factory.createConnectPacketV4(true, 0, "client")
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      vi.mocked(transport.send).mockClear();

      transport.packetReceivedHandler(
        MqttPacketV4Factory.createSubscribePacketV4(42, [[topic, 1]])
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(transport.send).toHaveBeenCalledWith(
        MqttPacketV4Factory.createSubackPacketV4(42, [
          SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
        ])
      );
      expect(transport.send).toHaveBeenCalledWith(
        MqttPacketV4Factory.createPublishPacketV4(
          topic,
          payload,
          MqttPacketV4Factory.createPublishFlagsV4(0, true)
        )
      );
    });

    it("assigns a non-zero packet identifier to a retained QoS 1 PUBLISH", async () => {
      const { transport } = connectionMock;
      const topic = "home/light";
      const payload = new Uint8Array([1]);
      retainedMessages.set(topic, payload, 1);

      transport.packetReceivedHandler(
        MqttPacketV4Factory.createConnectPacketV4(true, 0, "client")
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      vi.mocked(transport.send).mockClear();

      transport.packetReceivedHandler(
        MqttPacketV4Factory.createSubscribePacketV4(42, [[topic, 1]])
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(transport.send).toHaveBeenCalledWith(
        MqttPacketV4Factory.createSubackPacketV4(42, [
          SubackReturnCodeV4.SUCCESS_MAXIMUM_QOS_1,
        ])
      );
      const publication = vi.mocked(transport.send).mock.calls
        .map(([packet]) => packet)
        .find((packet) => packet.typeId === PacketType.PUBLISH);
      expect(publication).toMatchObject({
        topicName: topic,
        applicationMessage: payload,
        flags: { qosLevel: 1, retain: true },
      });
      const identifier = publication?.identifier;
      expect(identifier).toBeTypeOf("number");
      expect(Number.isInteger(identifier)).toBe(true);
      expect(identifier).toBeGreaterThan(0);
      expect(identifier).toBeLessThanOrEqual(0xffff);
    });

    describe("Keep Alive", () => {
      beforeEach(() => vi.useFakeTimers());
      afterEach(() => vi.useRealTimers());

      async function connect(keepAlive: number) {
        const { transport } = connectionMock;
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createConnectPacketV4(false, keepAlive, "client")
        );
        await vi.advanceTimersByTimeAsync(0);
        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(false)
        );
        return transport;
      }

      // MQTT 3.1.1 section 3.1.2.10 [MQTT-3.1.2-24].
      it("disconnects an idle client after one and a half Keep Alive periods", async () => {
        const transport = await connect(10);

        await vi.advanceTimersByTimeAsync(14_999);
        expect(transport.disconnect).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(transport.disconnect).toHaveBeenCalledTimes(1);
      });

      it("restarts the inactivity period when receiving PINGREQ", async () => {
        const transport = await connect(10);
        await vi.advanceTimersByTimeAsync(9_000);
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createSimplePacketV4(PacketType.PINGREQ)
        );

        await vi.advanceTimersByTimeAsync(14_999);
        expect(transport.disconnect).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(transport.disconnect).toHaveBeenCalledTimes(1);
      });

      it("restarts the inactivity period when receiving SUBSCRIBE", async () => {
        const transport = await connect(10);
        await vi.advanceTimersByTimeAsync(9_000);
        transport.packetReceivedHandler(
          MqttPacketV4Factory.createSubscribePacketV4(42, [["home/light", 0]])
        );

        await vi.advanceTimersByTimeAsync(14_999);
        expect(transport.disconnect).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(transport.disconnect).toHaveBeenCalledTimes(1);
      });

      it("does not apply a Keep Alive timeout when the value is zero", async () => {
        const transport = await connect(0);

        await vi.advanceTimersByTimeAsync(60_000);

        expect(transport.disconnect).not.toHaveBeenCalled();
      });

      it("starts the Keep Alive timeout only after sending CONNACK", async () => {
        const { transport } = connectionMock;
        let finishSend!: () => void;
        vi.mocked(transport.send).mockReturnValueOnce(
          new Promise<void>((resolve) => {
            finishSend = resolve;
          })
        );

        transport.packetReceivedHandler(
          MqttPacketV4Factory.createConnectPacketV4(false, 10, "client")
        );
        await vi.advanceTimersByTimeAsync(15_000);

        expect(transport.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnackPacketV4(false)
        );
        expect(transport.disconnect).not.toHaveBeenCalled();

        finishSend();
        await vi.advanceTimersByTimeAsync(14_999);
        expect(transport.disconnect).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(transport.disconnect).toHaveBeenCalledTimes(1);
      });

      it("clears the Keep Alive timer when the transport reports closure", async () => {
        const initialTimerCount = vi.getTimerCount();
        const transport = await connect(10);
        expect(vi.getTimerCount()).toBeGreaterThan(initialTimerCount);

        transport.disconnectHandler();

        expect(vi.getTimerCount()).toBe(initialTimerCount);
      });
    });

    // A second CONNECT on the same transport violates [MQTT-3.1.0-2].
    it("closes the transport on a second CONNECT without authenticating again", async () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true,
        0,
        "client"
      );
      const secondPacket = MqttPacketV4Factory.createConnectPacketV4(
        true,
        0,
        "other"
      );
      const { transport } = connectionMock;

      transport.packetReceivedHandler(packet);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(transport.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createConnackPacketV4(false)
      );
      expect(transport.disconnect).not.toHaveBeenCalled();

      transport.packetReceivedHandler(secondPacket);
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(authManagerMock.canLogin).toHaveBeenCalledTimes(1);
      expect(transport.send).toHaveBeenCalledTimes(1);
      expect(transport.disconnect).toHaveBeenCalledTimes(1);
    });

    // After refusal the broker must not process further data [MQTT-3.1.4-5].
    it("ignores the next packet after a refused CONNECT even before transport closure", async () => {
      vi.mocked(authManagerMock.canLogin).mockReturnValueOnce(false);
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true,
        0,
        "client"
      );
      const { transport } = connectionMock;

      transport.packetReceivedHandler(packet);
      transport.packetReceivedHandler(packet);
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(authManagerMock.canLogin).toHaveBeenCalledTimes(1);
      expect(transport.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createConnackPacketV4(
          false,
          ConnackReturnCodeV4.CONNECTION_REFUSED_NOT_AUTHORIZED
        )
      );
      expect(transport.disconnect).toHaveBeenCalledTimes(1);
    });

    it("closes the transport with the original error when sending CONNACK fails", async () => {
      const error = new Error("Could not send CONNACK");
      const clientConnectedListener = vi.fn();
      broker.on("clientConnected", clientConnectedListener);
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true,
        0,
        "client"
      );
      const { transport } = connectionMock;
      vi.mocked(transport.send).mockRejectedValueOnce(error);

      transport.packetReceivedHandler(packet);
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(transport.disconnect).toHaveBeenCalledExactlyOnceWith(error);
      expect(clientConnectedListener).not.toHaveBeenCalled();
    });

    it("reports a failed disconnect without reporting the connection as closed", async () => {
      const error = new Error("Could not disconnect");
      const errorListener = vi.fn();
      const closeListener = vi.fn();
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true,
        0,
        "client"
      );
      const { transport } = connectionMock;
      broker.on("brokerError", errorListener);
      broker.on("connectionClosed", closeListener);
      vi.mocked(authManagerMock.canLogin).mockReturnValue(false);
      vi.mocked(transport.disconnect).mockRejectedValueOnce(error);

      transport.packetReceivedHandler(packet);
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(transport.disconnect).toHaveBeenCalledExactlyOnceWith();
      expect(errorListener).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          source: "connection-transport",
          connectionId: expect.any(Number),
          error,
        })
      );
      expect(closeListener).not.toHaveBeenCalled();
    });
  });

  describe("on transport disconnect", () => {
    it.each([undefined, new Error("Transport failed")])(
      "reports connection closure once (error: %s)",
      (error) => {
        const connectionListener = vi.fn();
        const closeListener = vi.fn();

        broker.on("connection", connectionListener);
        broker.on("connectionClosed", closeListener);
        broker.addConnectionListener(listenerMock);
        listenerMock.connectionHandler(connectionMock);

        const { connectionId } = connectionListener.mock.calls[0][0];

        connectionMock.transport.disconnectHandler(error);
        connectionMock.transport.disconnectHandler(error);

        expect(closeListener).toHaveBeenCalledExactlyOnceWith({
          connectionId,
          connectionInfo: connectionMock.info,
          ...(error
            ? { reason: "transport-error", error }
            : { reason: "transport-closed" }),
        });
      }
    );
  });
});
