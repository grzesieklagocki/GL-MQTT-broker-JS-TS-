import { MqttClientV4 } from "@mqtt/client/v4/client";
import { ConnectResponse } from "@mqtt/client/v4/types";
import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { ConnackPacketV4, ConnackReturnCodeV4 } from "@mqtt/protocol/v4/types";
import { IPacketIdentifierManager } from "@mqtt/shared/types";
import EventEmitter from "node:events";
import { expect, vi } from "vitest";

export const createMqttClientV4TestContext = () => {
  const transportMock = Object.assign(new EventEmitter(), {
    connect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  });

  const managerMock = {
    allocateIdentifier: vi.fn().mockReturnValue(1),
    releaseIdentifier: vi.fn(),
  } as unknown as IPacketIdentifierManager;

  const client = new MqttClientV4(transportMock, managerMock);

  const connackAccepted = MqttPacketV4Factory.createConnackPacketV4(
    false,
    ConnackReturnCodeV4.CONNECTION_ACCEPTED
  );

  const connectClient = async (
    connack: ConnackPacketV4 = connackAccepted
  ): Promise<ConnectResponse> => {
    transportMock.send.mockImplementationOnce(async () => {
      transportMock.emit("packetReceived", connack);
    });

    return client.connect("");
  };

  const connectClientAndClearSendMock = async (): Promise<void> => {
    await connectClient();

    expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
      MqttPacketV4Factory.createConnectPacketV4(true, 60, "")
    );

    transportMock.send.mockClear();
  };

  return {
    client,
    transportMock,
    managerMock,
    connackAccepted,
    connectClient,
    connectClientAndClearSendMock,
  };
};
