import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { AppError } from "@src/AppError";
import { PacketType } from "@mqtt/protocol/shared/types";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMqttClientV4TestContext } from "./createMqttClientV4TestContext";

// disallowed packets to receive for client
describe("MqttClientV4", () => {
  describe("receiving disallowed packets", () => {
    let testContext: ReturnType<typeof createMqttClientV4TestContext>;

    beforeAll(() => {
      vi.useFakeTimers();
    });

    beforeEach(() => {
      testContext = createMqttClientV4TestContext();
    });

    // disallowed packets to receive for client
    const disallowed = [
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
    ];

    disallowed.forEach((packet) => {
      it(`call disconnect event with error when received ${PacketType[packet.typeId]} packet`, () => {
        // set event listener for disconnect event
        const onDisconnect = vi.fn();
        testContext.client.on("disconnect", onDisconnect);

        testContext.transportMock.emit("packetReceived", packet); // simulate receiving disallowed packet by client

        vi.waitFor(() => {
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
