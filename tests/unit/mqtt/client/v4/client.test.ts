import { AppError } from "@src/AppError";
import { MqttClientV4 } from "@mqtt/client/v4/client";
import { PacketType } from "@mqtt/protocol/shared/types";
import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { IPacketIdentifierManager } from "@mqtt/shared/types";
import { EventEmitter } from "node:events";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("MqttClientV4", () => {
  let managerMock: IPacketIdentifierManager;
  let transportMock: EventEmitter & {
    send: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  let client: MqttClientV4;

  beforeEach(() => {
    // create mocks for tests
    transportMock = Object.assign(new EventEmitter(), {
      send: vi.fn(),
      disconnect: vi.fn(),
    });

    managerMock = {
      allocateIdentifier: vi.fn().mockImplementationOnce(() => 1),
    } as unknown as IPacketIdentifierManager;

    client = new MqttClientV4(transportMock, managerMock);
  });

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
        it(`sends PUBACK packet with same packet identifier (${packetId}) when received PUBLISH packet with QOS 1`, () => {
          const flags = MqttPacketV4Factory.createPublishFlagsV4(1); // qos: 1
          const packet = MqttPacketV4Factory.createPublishPacketV4(
            topic,
            message,
            flags,
            packetId // packet identifier
          );

          expect(packet.typeId).toBe(PacketType.PUBLISH);
          expect(packet.flags.qosLevel).toBe(1);

          transportMock.emit("packetReceived", packet); // simulate receiving a PUBLISH packet by client

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
        MqttPacketV4Factory.createPublishPacketV4(
          topic,
          message,
          MqttPacketV4Factory.createPublishFlagsV4(2),
          0xffff
        ),
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

      it.todo("TODO when received PUBLISH packet with QOS 2");
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

  describe("methods", () => {
    beforeEach(() => {
      transportMock = Object.assign(new EventEmitter(), {
        send: vi.fn(),
        disconnect: vi.fn(),
      });

      managerMock = {
        allocateIdentifier: vi.fn(() => 1),
        releaseIdentifier: vi.fn(),
      } as unknown as IPacketIdentifierManager;

      client = new MqttClientV4(transportMock, managerMock);

      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.clearAllMocks();
    });
    describe("subscribeAsync()", () => {
      it("rejects when SUBACK is not received before timeout", async () => {
        const promise = client.subscribeAsync([]);

        vi.advanceTimersByTime(10_100);

        await expect(promise).rejects.toThrow(/timeout/);
      });

      it("returns SUBACK return codes when SUBACK is received before timeout", async () => {
        const suback = MqttPacketV4Factory.createSubackPacketV4(1, [2, 0, 1]);

        transportMock.send.mockImplementation(() => {
          setTimeout(() => {
            transportMock.emit("packetReceived", suback);
          }, 9_900);
        });

        const promise = client.subscribeAsync([
          // will be ignored in this test
        ]);

        vi.advanceTimersByTime(10_000);

        await expect(promise).resolves.toEqual([2, 0, 1]);
        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createSubscribePacketV4(1, [])
        );
      });

      it("rejects when SUBACK is received with a different packet identifier", async () => {
        const suback = MqttPacketV4Factory.createSubackPacketV4(2, [2, 0, 1]);

        transportMock.send.mockImplementation(() => {
          setTimeout(() => {
            transportMock.emit("packetReceived", suback);
          }, 9_900);
        });

        const promise = client.subscribeAsync([
          // will be ignored in this test
        ]);

        vi.advanceTimersByTime(10_000);

        await expect(promise).rejects.toThrow(/timeout/);
        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createSubscribePacketV4(1, [])
        );
      });

      it("rejects when respond with a different packet type than SUBACK", async () => {
        const unsuback = MqttPacketV4Factory.createPacketWithIdentifierV4(
          PacketType.UNSUBACK,
          1
        );

        transportMock.send.mockImplementation(() => {
          setTimeout(() => {
            transportMock.emit("packetReceived", unsuback);
          }, 9_900);
        });

        const promise = client.subscribeAsync([
          // will be ignored in this test
        ]);

        vi.advanceTimersByTime(10_000);

        await expect(promise).rejects.toThrow(/timeout/);
        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createSubscribePacketV4(1, [])
        );
      });
    });

    describe("unsubscribeAsync()", () => {
      it("rejects when UNSUBACK is not received before timeout", async () => {
        const promise = client.unsubscribeAsync([]);

        vi.advanceTimersByTime(10_100);

        await expect(promise).rejects.toThrow(/timeout/);
      });

      it("resolves when UNSUBACK is received before timeout", async () => {
        const unsuback = MqttPacketV4Factory.createPacketWithIdentifierV4(
          PacketType.UNSUBACK,
          1
        );

        transportMock.send.mockImplementation(() => {
          setTimeout(() => {
            transportMock.emit("packetReceived", unsuback);
          }, 9_900);
        });

        const promise = client.unsubscribeAsync([
          // will be ignored in this test
        ]);

        vi.advanceTimersByTime(10_000);

        await expect(promise).resolves.toBeUndefined();
        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createUnsubscribePacketV4(1, [])
        );
      });

      it("rejects when UNSUBACK is received with a different packet identifier", async () => {
        const unsuback = MqttPacketV4Factory.createPacketWithIdentifierV4(
          PacketType.UNSUBACK,
          2
        );

        transportMock.send.mockImplementation(() => {
          setTimeout(() => {
            transportMock.emit("packetReceived", unsuback);
          }, 9_900);
        });

        const promise = client.unsubscribeAsync([
          // will be ignored in this test
        ]);

        vi.advanceTimersByTime(10_000);

        await expect(promise).rejects.toThrow(/timeout/);
        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createUnsubscribePacketV4(1, [])
        );
      });

      it("rejects when respond with a different packet type than UNSUBACK", async () => {
        const suback = MqttPacketV4Factory.createSubackPacketV4(1, []);

        transportMock.send.mockImplementation(() => {
          setTimeout(() => {
            transportMock.emit("packetReceived", suback);
          }, 9_900);
        });

        const promise = client.unsubscribeAsync([
          // will be ignored in this test
        ]);

        vi.advanceTimersByTime(10_000);

        await expect(promise).rejects.toThrow(/timeout/);
        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createUnsubscribePacketV4(1, [])
        );
      });
    });
  });
});
