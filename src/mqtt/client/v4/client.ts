import { AppError } from "@src/AppError";
import { ITransportAdapterV4 } from "./types";
import { IPacketIdentifierManager } from "@mqtt/shared/types";
import { ConnectionStatus } from "../shared/types";
import { MqttPacketV4Factory } from "@src/mqtt/protocol/v4/MqttPacketV4Factory";
import { PacketType } from "@src/mqtt/protocol/shared/types";
import { AnyPacketV4 } from "@src/mqtt/protocol/v4/types";

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
  ) {
    this.transport.on("packetReceived", (packet) => {
      this.handleReceivedPacket(packet);
    });
  }

  /**
   * Handles a received MQTT packet and sends response if necessary.
   * @param packet - The received MQTT packet.
   */
  private handleReceivedPacket(packet: AnyPacketV4) {
    let response: AnyPacketV4 | undefined;
    
    switch (packet.typeId) {
      case PacketType.PUBLISH:
        switch (packet.flags.qosLevel) {
          case 0:
            break;
          case 1:
            response = MqttPacketV4Factory.createPacketWithIdentifierV4(
              PacketType.PUBACK,
              packet.identifier!
            );
            break;
        }

        break;
      default:
        throw Error();
    }

    if (response) this.transport.send(response);
  }

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
