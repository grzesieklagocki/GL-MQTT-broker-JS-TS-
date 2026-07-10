import { AppError } from "@src/AppError";
import { ITransportAdapterV4 } from "./types";
import { IPacketIdentifierManager } from "@mqtt/shared/types";
import { ConnectionStatus } from "../shared/types";
import { MqttPacketV4Factory } from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { PacketType } from "@mqtt/protocol/shared/types";
import {
  AnyPacketV4,
  PublishPacketV4,
  SubackReturnCodeV4,
  SubscriptionV4,
} from "@mqtt/protocol/v4/types";
import { EventEmitter } from "stream";

export class MqttClientV4 extends EventEmitter {
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
    super();

    this.transport.on("packetReceived", (packet) => {
      this.handleReceivedPacket(packet);
    });
  }

  public async subscribe(
    subscriptionList: SubscriptionV4[]
  ): Promise<SubackReturnCodeV4[]> {
    return new Promise((resolve, reject) => {
      const packetId = this.packetIdManager.allocateIdentifier();

      const packet = MqttPacketV4Factory.createSubscribePacketV4(
        packetId,
        subscriptionList
      );

      const cleanup = () => {
        clearTimeout(timeout);
        this.transport.off("packetReceived", waitForSuback); // remove listener for this SUBACK packet
        this.packetIdManager.releaseIdentifier(packetId); // release the allocated packet identifier
      };

      const waitForSuback = (receivedPacket: AnyPacketV4) => {
        if (
          receivedPacket.typeId !== PacketType.SUBACK ||
          receivedPacket.identifier !== packetId
        ) {
          return;
        }

        // if the received packet is the expected SUBACK packet
        cleanup();
        resolve(receivedPacket.returnCodeList);
      };

      const timeout = setTimeout(() => {
        // if the SUBACK packet is not received in defined time
        cleanup();
        reject(new AppError("timeout"));
      }, 10_000);

      this.transport.on("packetReceived", waitForSuback);
      this.transport.send(packet);
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
        response = this.handlePublishPacketReceived(packet);
        break;

      case PacketType.CONNACK:
      case PacketType.PUBACK:
      case PacketType.PUBREC:
      case PacketType.PUBREL:
      case PacketType.PUBCOMP:
      case PacketType.SUBACK:
      case PacketType.UNSUBACK:
      case PacketType.PINGRESP:
        break;

      default:
        this.handleDisconnect(
          new AppError(
            `Client received disallowed packet type: ${PacketType[packet.typeId]}`
          )
        );
    }

    if (response) this.transport.send(response);
  }

  private handlePublishPacketReceived(
    packet: PublishPacketV4
  ): AnyPacketV4 | undefined {
    this.emit("publish", packet.topicName, packet.applicationMessage);

    if (packet.flags.qosLevel === 1)
      return MqttPacketV4Factory.createPacketWithIdentifierV4(
        PacketType.PUBACK,
        packet.identifier!
      );

    return undefined;
  }

  /**
   * Handles the disconnection of the MQTT client and emits a disconnect event.
   * @param error - Optional error that caused the disconnection.
   */
  private handleDisconnect(error?: AppError) {
    this.emit("disconnect", error);
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
