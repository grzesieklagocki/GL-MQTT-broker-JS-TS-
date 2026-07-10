import { MqttClientV4 } from "@src/mqtt/client/v4/client";
import { ITransportAdapterV4 } from "@src/mqtt/client/v4/types";
import { PacketType } from "@src/mqtt/protocol/shared/types";
import { MqttPacketV4Factory } from "@src/mqtt/protocol/v4/MqttPacketV4Factory";
import { IPacketIdentifierManager } from "@src/mqtt/shared/types";
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

        expect(packet.flags.qosLevel).toBe(1);

        transportMock.emit("packetReceived", packet); // simulate receiving a PUBLISH packet

        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createPacketWithIdentifierV4(
            PacketType.PUBACK,
            packetId
          )
        );
      });
    });

    it.todo("TODO when received PUBLISH packet with QOS 2");

    it("throws when received CONNECT packet", () => {
      const packet = MqttPacketV4Factory.createConnectPacketV4(
        true, // clean session
        60, // keep alive
        "clientID"
      );
    });
  });
});
