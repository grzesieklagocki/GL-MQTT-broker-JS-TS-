import { AppError } from "@src/AppError";
import { MqttClientV4 } from "@mqtt/client/v4/client";
import { ITransportAdapterV4 } from "@mqtt/client/v4/types";
import { PacketType } from "@mqtt/protocol/shared/types";
import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { IPacketIdentifierManager } from "@mqtt/shared/types";
import { EventEmitter } from "stream";
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("MqttClientV4", () => {
  describe("on receiving packets", () => {
    let managerMock: IPacketIdentifierManager;
    let transportMock: ITransportAdapterV4;
    let client: MqttClientV4;

    beforeEach(() => {
      // create mocks for tests
      transportMock = Object.assign(new EventEmitter(), {
        send: vi.fn(),
      });
      managerMock = {} as unknown as IPacketIdentifierManager;

      client = new MqttClientV4(transportMock, managerMock);
    });

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
          "topic",
          undefined, // message
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

    it.todo("TODO when received PUBLISH packet with QOS 2");

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
});
