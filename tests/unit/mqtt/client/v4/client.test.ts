import { AppError } from "@src/AppError";
import { MqttClientV4 } from "@mqtt/client/v4/client";
import { AnyPacket, PacketType } from "@mqtt/protocol/shared/types";
import {
  MqttPacketV4Factory,
  Will,
} from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { IPacketIdentifierManager, MqttAuth } from "@mqtt/shared/types";
import { EventEmitter } from "node:events";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AnyPacketV4,
  ConnackPacketV4,
  ConnackReturnCodeV4,
  SubscriptionV4,
} from "@mqtt/protocol/v4/types";
import { ConnectionStatus } from "@src/mqtt/client/shared/types";

describe("MqttClientV4", () => {
  let managerMock: IPacketIdentifierManager;
  let transportMock: EventEmitter & {
    connect: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  let client: MqttClientV4;

  beforeEach(() => {
    vi.useFakeTimers();

    // create mocks for tests
    transportMock = Object.assign(new EventEmitter(), {
      connect: vi.fn(),
      send: vi.fn(),
      disconnect: vi.fn(),
    });

    managerMock = {
      allocateIdentifier: vi.fn().mockImplementation(() => 1),
      releaseIdentifier: vi.fn(),
    } as unknown as IPacketIdentifierManager;

    client = new MqttClientV4(transportMock, managerMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const connackAccepted: ConnackPacketV4 =
    MqttPacketV4Factory.createConnackPacketV4(
      false,
      ConnackReturnCodeV4.CONNECTION_ACCEPTED
    );

  describe("on receiving packets", () => {
    describe("PUBLISH", () => {
      const topic = "a/b";
      const message = new Uint8Array([0x00, 0x03, 0x6d, 0x73, 0x67]);

      it("sends nothing when received PUBLISH packet with QOS 0", () => {
        const packet = MqttPacketV4Factory.createPublishPacketV4("topic");

        expect(packet.typeId).toBe(PacketType.PUBLISH);
        expect(packet.flags.qosLevel).toBe(0);

        transportMock.emit("packetReceived", packet); // simulate receiving a PUBLISH packet

        expect(transportMock.send).not.toBeCalled();
      });

      [1, 0xa1, 0xff].forEach((packetId) => {
        it(`sends PUBACK packet with same packet identifier (${packetId}) when received PUBLISH packet with QOS 1`, async () => {
          const flags = MqttPacketV4Factory.createPublishFlagsV4(1); // qos: 1
          const packet = MqttPacketV4Factory.createPublishPacketV4(
            topic,
            message,
            flags,
            packetId // packet identifier
          );

          expect(packet.typeId).toBe(PacketType.PUBLISH);
          expect(packet.flags.qosLevel).toBe(1);

          await transportMock.emit("packetReceived", packet); // simulate receiving a PUBLISH packet by client

          expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
            MqttPacketV4Factory.createPacketWithIdentifierV4(
              PacketType.PUBACK,
              packetId
            )
          );
        });
      });

      [
        // qos: 0
        MqttPacketV4Factory.createPublishPacketV4(topic, message),

        // qos: 1
        MqttPacketV4Factory.createPublishPacketV4(
          topic,
          message,
          MqttPacketV4Factory.createPublishFlagsV4(1),
          0xffff
        ),

        // qos: 2
        // MqttPacketV4Factory.createPublishPacketV4(
        //   topic,
        //   message,
        //   MqttPacketV4Factory.createPublishFlagsV4(2),
        //   0xffff
        // ),
      ].forEach((packet) => {
        it(`call publish event with provided topic and message when received PUBLISH packet with QOS ${packet.flags.qosLevel}`, () => {
          expect(packet.typeId).toBe(PacketType.PUBLISH);
          // expect(packet.flags.qosLevel).toBe(p);

          // set event listener for publish event
          const onPublish = vi.fn();
          client.on("publish", onPublish);

          transportMock.emit("packetReceived", packet); // simulate receiving a PUBLISH packet

          expect(onPublish).toHaveBeenCalledExactlyOnceWith(topic, message);
        });
      });

      it.todo(
        "TODO: call publish event with provided topic and message when received PUBLISH packet with QOS"
      );

      it.todo("TODO: when received PUBLISH packet with QOS 2");
    });

    // disallowed packets to receive for client
    describe("disallowed packets", () => {
      // disallowed packets to receive for client
      [
        // CONNECT
        MqttPacketV4Factory.createConnectPacketV4(
          true, // clean session
          60, // keep alive
          "clientID"
        ),

        // SUBSCRIBE
        MqttPacketV4Factory.createSubscribePacketV4(
          3722, // packet identifier
          [] // empty subscription list
        ),

        // UNSUBSCRIBE
        MqttPacketV4Factory.createUnsubscribePacketV4(
          82445, // packet identifier
          [] // empty subscription list
        ),

        // PINGREQ
        MqttPacketV4Factory.createSimplePacketV4(PacketType.PINGREQ),

        // DISCONNECT
        MqttPacketV4Factory.createSimplePacketV4(PacketType.DISCONNECT),
      ].forEach((packet) => {
        it(`call disconnect event with error when received ${PacketType[packet.typeId]} packet`, () => {
          // set event listener for disconnect event
          const onDisconnect = vi.fn();
          client.on("disconnect", onDisconnect);

          transportMock.emit("packetReceived", packet); // simulate receiving disallowed packet by client

          expect(onDisconnect).toHaveBeenCalledExactlyOnceWith(
            new AppError(
              `Client received disallowed packet type: ${PacketType[packet.typeId]}`
            )
          );
        });
      });
    });
  });

  describe("getters", () => {
    describe("isConnected", () => {
      it("returns false when client is not connected", () => {
        expect(client.isConnected).toBe(false);
      });

      it("returns false while connecting", () => {
        expect(testConnect()).rejects.toThrow(/timeout/);
        expect(client.isConnected).toBe(false);
      });

      it(`returns true after cuccessfully connected  ${ConnackReturnCodeV4[connackAccepted.connectReturnCode]} code`, async () => {
        const status = await testConnect(connackAccepted);

        expect(status.returnCode).toBe(ConnackReturnCodeV4.CONNECTION_ACCEPTED);
        expect(client.isConnected).toBe(true);
      });

      [
        ConnackReturnCodeV4.CONNECTION_REFUSED_BAD_USER_NAME_OR_PASSWORD,
        ConnackReturnCodeV4.CONNECTION_REFUSED_IDENTIFIER_REJECTED,
        ConnackReturnCodeV4.CONNECTION_REFUSED_NOT_AUTHORIZED,
        ConnackReturnCodeV4.CONNECTION_REFUSED_SERVER_UNAVAILABLE,
        ConnackReturnCodeV4.CONNECTION_REFUSED_UNACCEPTABLE_PROTOCOL_VERSION,
      ].forEach((refusedCode) => {
        it(`returns false after unsuccessful connection attempt with ${ConnackReturnCodeV4[refusedCode]} code`, async () => {
          const connackRefused = MqttPacketV4Factory.createConnackPacketV4(
            true,
            refusedCode
          );

          const status = await testConnect(connackRefused);

          expect(status.returnCode).toBe(refusedCode);
          expect(status.sessionPresent).toBe(true);
          expect(client.isConnected).toBe(false);
        });
      });

      it("returns false after disconnect", async () => {
        // before connect
        expect(client.isConnected).toBe(false);

        // after successful connect
        await testConnect(connackAccepted);
        expect(client.isConnected).toBe(true);

        // after disconnect
        await client.disconnect();
        expect(client.isConnected).toBe(false);
      });
    });
  });

  describe("methods", () => {
    describe("getConnectionStatus()", () => {
      it("returns DISCONNECTED status when client is not connected", () => {
        expect(client.getConnectionStatus()).toBe(
          ConnectionStatus.DISCONNECTED
        );
      });

      it("returns CONNECTING status while connecting", async () => {
        let status = client.getConnectionStatus();
        expect(status).toBe(ConnectionStatus.DISCONNECTED);

        await testConnect(
          connackAccepted,
          // get connection status while connecting
          () => (status = client.getConnectionStatus()) // will be called before receiving CONNACK packet
        );
        expect(status).toBe(ConnectionStatus.CONNECTING);
      });

      it(`returns CONNECTED status after cuccessfully connected with ${ConnackReturnCodeV4[connackAccepted.connectReturnCode]} code`, async () => {
        const status = await testConnect(connackAccepted);

        expect(status.returnCode).toBe(ConnackReturnCodeV4.CONNECTION_ACCEPTED);
        expect(client.getConnectionStatus()).toBe(ConnectionStatus.CONNECTED);
      });

      ///

      [
        ConnackReturnCodeV4.CONNECTION_REFUSED_BAD_USER_NAME_OR_PASSWORD,
        ConnackReturnCodeV4.CONNECTION_REFUSED_IDENTIFIER_REJECTED,
        ConnackReturnCodeV4.CONNECTION_REFUSED_NOT_AUTHORIZED,
        ConnackReturnCodeV4.CONNECTION_REFUSED_SERVER_UNAVAILABLE,
        ConnackReturnCodeV4.CONNECTION_REFUSED_UNACCEPTABLE_PROTOCOL_VERSION,
      ].forEach((refusedCode) => {
        it(`returns DISCONNECTED after unsuccessful connection attempt with ${ConnackReturnCodeV4[refusedCode]} code`, async () => {
          const connackRefused = MqttPacketV4Factory.createConnackPacketV4(
            true,
            refusedCode
          );

          const status = await testConnect(connackRefused);

          expect(status.returnCode).toBe(refusedCode);
          expect(status.sessionPresent).toBe(true);
          expect(client.getConnectionStatus()).toBe(
            ConnectionStatus.DISCONNECTED
          );
        });
      });
    });

    describe("connect()", () => {
      it("rejects when CONNACK is not received before timeout", async () => {
        const promise = testConnect();

        await expect(promise).rejects.toThrow(/timeout/);
      });

      it("returns connection information when CONNACK is received before timeout", async () => {
        const connack = MqttPacketV4Factory.createConnackPacketV4(
          true,
          ConnackReturnCodeV4.CONNECTION_REFUSED_NOT_AUTHORIZED
        );

        const promise = testConnect(connack);

        await expect(promise).resolves.toEqual({
          returnCode: ConnackReturnCodeV4.CONNECTION_REFUSED_NOT_AUTHORIZED,
          sessionPresent: true,
        });
        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnectPacketV4(true, 60, "")
        );
      });

      it("rejects when respond with a different packet type than CONNACK", async () => {
        const unsuback = MqttPacketV4Factory.createPacketWithIdentifierV4(
          PacketType.UNSUBACK,
          1
        );

        const promise = testConnect(unsuback);

        await expect(promise).rejects.toThrow(/timeout/);
        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnectPacketV4(true, 60, "")
        );
      });

      it("pass all parameters to the connect packet when calling connect()", async () => {
        const auth = { user: "user", password: new Uint8Array([1, 2, 3]) };

        const will: Will = {
          topic: "will/topic",
          message: new Uint8Array([4, 5, 6]),
          qos: 1,
          retain: true,
        };

        const connack = MqttPacketV4Factory.createConnackPacketV4(
          true,
          ConnackReturnCodeV4.CONNECTION_ACCEPTED
        );

        const promise = testConnect(
          connack,
          () => {},
          "clientID",
          auth,
          will,
          120,
          false
        );

        await expect(promise).resolves.toEqual({
          returnCode: ConnackReturnCodeV4.CONNECTION_ACCEPTED,
          sessionPresent: true,
        });

        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnectPacketV4(
            false,
            120,
            "clientID",
            auth.user,
            auth.password,
            will
          )
        );
      });

      it("calls connect() on transport adapter", async () => {
        await testConnect(connackAccepted);

        expect(transportMock.connect).toHaveBeenCalledOnce();
      });

      it("disconnects when transport adapter emits disconnect event", async () => {
        const error = new Error("DISONNECT TEST");

        await testConnect(connackAccepted);

        expect(client.isConnected).toBe(true);

        transportMock.emit("disconnect", error);

        expect(client.isConnected).toBe(false);
      });

      it("call disconnect event with error when transport adapter emits disconnect event", async () => {
        const onDisconnect = vi.fn();
        const error = new Error("DISONNECT TEST");

        await testConnect(connackAccepted);

        client.on("disconnect", onDisconnect);
        transportMock.emit("disconnect", error);
        client.off("disconnect", onDisconnect);

        expect(onDisconnect).toHaveBeenCalledExactlyOnceWith(error);
      });

      it("rejects when transport connect() rejects", async () => {
        transportMock.connect.mockRejectedValueOnce(
          new Error("TRANSPORT CONNECT ERROR")
        );

        const promise = client.connect("");

        expect(transportMock.connect).toHaveBeenCalledExactlyOnceWith();

        await expect(promise).rejects.toThrow(/TRANSPORT CONNECT ERROR/);
      });

      it("rejects when transport connect() takes too long to resolve", async () => {
        transportMock.connect.mockImplementationOnce(
          () => new Promise(() => {})
        );

        const promise = client.connect("");
        const assertion = expect(promise).rejects.toThrow(/timeout/i);

        expect(transportMock.connect).toHaveBeenCalledExactlyOnceWith();

        await vi.advanceTimersByTimeAsync(5_000);

        await assertion;
      });
    });

    describe("subscribe()", () => {
      const subscriptionList: SubscriptionV4[] = [
        ["t/1", 2],
        ["t/2", 0],
        ["t/3", 1],
      ];
      const returnCodeList = subscriptionList.map((sub) => sub[1]);

      const subscribePacket = (identifier = 1) =>
        MqttPacketV4Factory.createSubscribePacketV4(
          identifier,
          subscriptionList
        );

      const subackPacket = (identifier = 1) =>
        MqttPacketV4Factory.createSubackPacketV4(identifier, returnCodeList);

      const expectSubscribeSent = (identifier = 1) => {
        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
          subscribePacket(identifier)
        );
      };

      it("rejects when SUBACK is not received before timeout", async () => {
        await connectAndClearSendMock();

        const promise = client.subscribe(subscriptionList);
        const assertion = expect(promise).rejects.toThrow(/timeout/);

        await vi.advanceTimersByTimeAsync(10_000);

        await assertion;

        expectSubscribeSent();
      });

      it("returns SUBACK return codes when SUBACK is received before timeout", async () => {
        await connectAndClearSendMock();

        transportMock.send.mockImplementationOnce(() => {
          transportMock.emit("packetReceived", subackPacket());
        });

        await expect(client.subscribe(subscriptionList)).resolves.toEqual([
          2, 0, 1,
        ]);

        expectSubscribeSent();
      });

      it("rejects when SUBACK is received with a different packet identifier", async () => {
        await connectAndClearSendMock();

        transportMock.send.mockImplementationOnce(() => {
          transportMock.emit("packetReceived", subackPacket(55));
        });

        const promise = client.subscribe(subscriptionList);
        const assertion = expect(promise).rejects.toThrow(/timeout/);

        await vi.advanceTimersByTimeAsync(10_000);

        await assertion;

        expectSubscribeSent();
      });

      it("rejects when respond with a different packet type than SUBACK", async () => {
        await connectAndClearSendMock();

        transportMock.send.mockImplementationOnce(() => {
          transportMock.emit(
            "packetReceived",
            MqttPacketV4Factory.createPacketWithIdentifierV4(
              PacketType.UNSUBACK,
              55
            )
          );
        });

        const promise = client.subscribe(subscriptionList);
        const assertion = expect(promise).rejects.toThrow(/timeout/);

        await vi.advanceTimersByTimeAsync(10_000);

        await assertion;

        expectSubscribeSent();
      });

      it("rejects when client is not connected", async () => {
        expect(client.isConnected).toBe(false);

        await expect(client.subscribe(subscriptionList)).rejects.toThrow(
          /not connected/
        );

        expect(transportMock.send).not.toHaveBeenCalled();
      });
    });

    describe("unsubscribe()", () => {
      const unsubscribePacket = (identifier = 1) =>
        MqttPacketV4Factory.createUnsubscribePacketV4(identifier, []);

      const unsubackPacket = (identifier = 1) =>
        MqttPacketV4Factory.createPacketWithIdentifierV4(
          PacketType.UNSUBACK,
          identifier
        );

      const expectUnsubscribeSent = (identifier = 1) => {
        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
          unsubscribePacket(identifier)
        );
      };

      it("rejects when UNSUBACK is not received before timeout", async () => {
        await connectAndClearSendMock();

        const promise = client.unsubscribe([]);
        const assertion = expect(promise).rejects.toThrow(/timeout/);

        await vi.advanceTimersByTimeAsync(10_000);

        await assertion;

        expectUnsubscribeSent();
      });

      it("resolves when UNSUBACK is received before timeout", async () => {
        await connectAndClearSendMock();

        transportMock.send.mockImplementationOnce(() => {
          transportMock.emit("packetReceived", unsubackPacket(1));
        });

        await expect(client.unsubscribe([])).resolves.toBeUndefined();

        expectUnsubscribeSent();
      });

      it("rejects when UNSUBACK is received with a different packet identifier", async () => {
        await connectAndClearSendMock();

        transportMock.send.mockImplementationOnce(() => {
          transportMock.emit("packetReceived", unsubackPacket(55));
        });

        const promise = client.unsubscribe([]);
        const assertion = expect(promise).rejects.toThrow(/timeout/);

        await vi.advanceTimersByTimeAsync(10_000);

        await assertion;

        expectUnsubscribeSent();
      });

      it("rejects when response has a different packet type than UNSUBACK", async () => {
        await connectAndClearSendMock();

        transportMock.send.mockImplementationOnce(() => {
          transportMock.emit(
            "packetReceived",
            MqttPacketV4Factory.createSubackPacketV4(1, [])
          );
        });

        const promise = client.unsubscribe([]);
        const assertion = expect(promise).rejects.toThrow(/timeout/);

        await vi.advanceTimersByTimeAsync(10_000);

        await assertion;

        expectUnsubscribeSent();
      });

      it("rejects when client is not connected", async () => {
        expect(client.isConnected).toBe(false);

        await expect(client.unsubscribe([])).rejects.toThrow(/not connected/);

        expect(transportMock.send).not.toHaveBeenCalled();
      });
    });

    describe("disconnect()", () => {
      it("calls disconnect() on transport adapter", async () => {
        await testConnect(connackAccepted);
        expect(client.isConnected).toBe(true);

        expect(transportMock.disconnect).not.toHaveBeenCalled();
        await client.disconnect();
        expect(transportMock.disconnect).toHaveBeenCalledExactlyOnceWith();
      });

      it("rejects when client is not connected", async () => {
        expect(client.isConnected).toBe(false);

        await expect(client.disconnect()).rejects.toThrow(/not connected/);
      });
    });
  });

  //
  // helpers
  //

  /**
   * Helper function to test the connect method of the MqttClientV4 class.
   * @param response - Optional ConnackPacketV4 to simulate receiving a CONNACK packet from the broker.
   * @param clientIdentifier - Optional client identifier to be used in the connect method.
   * @param auth - Optional authentication information (username and password) to be used in the connect method.
   * @param will - Optional will message to be used in the connect method, including topic, message, QoS, and retain flag.
   * @param keepAlive - Optional keep-alive value (in seconds) to be used in the connect method.
   * @param cleanSession - Optional boolean indicating whether to start a clean session (true) or not (false) in the connect method.
   * @returns A promise that resolves with the connection information (return code and session present flag) if the connection is successful,
   * or rejects with an error if the connection fails or times out.
   */
  const testConnect = (
    response?: AnyPacketV4,
    beforeConnack?: () => void,
    clientIdentifier?: string,
    auth?: MqttAuth,
    will?: Will,
    keepAlive?: number,
    cleanSession?: boolean
  ) => {
    transportMock.send.mockImplementation(() => {
      if (beforeConnack) beforeConnack();

      if (response) {
        // simulate receiving CONNACK packet by client
        vi.advanceTimersByTime(9_990);

        transportMock.emit("packetReceived", response);
      }

      vi.advanceTimersByTime(10_010);
    });

    return client.connect(
      clientIdentifier ?? "",
      auth,
      will,
      keepAlive,
      cleanSession
    );
  };

  const connectAndClearSendMock = async () => {
    await testConnect(connackAccepted);

    expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
      MqttPacketV4Factory.createConnectPacketV4(true, 60, "")
    );

    transportMock.send.mockClear();
  };
});
