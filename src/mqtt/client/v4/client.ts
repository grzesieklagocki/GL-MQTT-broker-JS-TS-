import { AppError } from "@src/AppError";
import { ITransportAdapterV4 } from "./types";
import { IPacketIdentifierManager } from "@mqtt/shared/types";
import { ConnectionStatus } from "../shared/types";

export class MqttClientV4 {
  private mqttConnectionStatus: ConnectionStatus =
    ConnectionStatus.DISCONNECTED;

  /**
   * Creates an instance of ClientV4.
   * @param transport - The transport adapter responsible for sending and receiving MQTT packets.
   * @param packetIdManager - The packet identifier manager responsible for generating unique packet identifiers.
   */
  public constructor(
    private readonly transport: ITransportAdapterV4,
    private readonly packetIdManager: IPacketIdentifierManager
  ) {}

  /**
   * Asserts that the MQTT client is currently connected.
   */
  private _assertClientConnected() {
    if (this.mqttConnectionStatus !== ConnectionStatus.CONNECTED)
      throw new AppError(
        `Client is not connected. Current status: ${ConnectionStatus[this.mqttConnectionStatus]}`
      );
  }
}
