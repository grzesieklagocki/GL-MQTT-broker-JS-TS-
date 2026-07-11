import { AppError } from "@src/AppError";
import { ITransportAdapterV4 } from "./types";
import { IPacketIdentifierManager, MqttAuth } from "@mqtt/shared/types";
import { ConnectionStatus } from "../shared/types";
import {
  MqttPacketV4Factory,
  Will,
} from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { PacketType } from "@mqtt/protocol/shared/types";
import {
  AnyPacketV4,
  ConnackPacketV4,
  ConnackReturnCodeV4,
  PublishPacketV4,
  SubackPacketV4,
  SubackReturnCodeV4,
  SubscriptionV4,
} from "@mqtt/protocol/v4/types";
import { EventEmitter } from "node:events";

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

  public async connectAsync(
    clientIdentifier: string,
    auth?: MqttAuth,
    will?: Will,
    keepAlive: number = 60,
    cleanSession: boolean = true
  ): Promise<{
    returnCode: ConnackReturnCodeV4;
    sessionPresent: boolean;
  }> {
    const packet = MqttPacketV4Factory.createConnectPacketV4(
      cleanSession,
      keepAlive,
      clientIdentifier,
      auth?.user,
      auth?.password,
      will
    );

    const matcher = (response: AnyPacketV4) =>
      response.typeId === PacketType.CONNACK;

    const resolver = (response: ConnackPacketV4) => {
      //set the connection status based on the return code from the CONNACK packet
      this.mqttConnectionStatus =
        response.connectReturnCode === ConnackReturnCodeV4.CONNECTION_ACCEPTED
          ? ConnectionStatus.CONNECTED
          : ConnectionStatus.DISCONNECTED;

      return {
        returnCode: response.connectReturnCode,
        sessionPresent: response.sessionPresentFlag,
      };
    };

    // set the connection status to connecting before sending the connect packet
    this.mqttConnectionStatus = ConnectionStatus.CONNECTING;

    const promise = this.createRequest(packet, matcher, resolver, 10);

    promise.catch(() => {
      // if the connection fails set the status back to disconnected
      this.mqttConnectionStatus = ConnectionStatus.DISCONNECTED;
    });

    return promise;
  }

  /**
   * Subscribes to a list of topics and returns the corresponding return codes from the broker.
   * @param subscriptionList - The list of topics to subscribe to, along with their requested QoS levels.
   * @returns A promise that resolves with an array of return codes indicating the result of each subscription request.
   */
  public async subscribeAsync(
    subscriptionList: SubscriptionV4[]
  ): Promise<SubackReturnCodeV4[]> {
    const packetId = this.packetIdManager.allocateIdentifier();
    const packet = MqttPacketV4Factory.createSubscribePacketV4(
      packetId,
      subscriptionList
    );

    const matcher = (response: AnyPacketV4) =>
      response.typeId === PacketType.SUBACK && response.identifier === packetId;
    const resolver = (response: SubackPacketV4) => response.returnCodeList;

    return this.createRequest(packet, matcher, resolver, 10);
  }

  /**
   * Unsubscribes from a list of topics.
   * @param topicFilterList - The list of topic filters to unsubscribe from.
   * @returns A promise that resolves when the unsubscription is successful or rejects with an error if the timeout is reached.
   */
  public async unsubscribeAsync(topicFilterList: string[]): Promise<void> {
    const packetId = this.packetIdManager.allocateIdentifier();
    const packet = MqttPacketV4Factory.createUnsubscribePacketV4(
      packetId,
      topicFilterList
    );

    const matcher = (response: AnyPacketV4) =>
      response.typeId === PacketType.UNSUBACK &&
      response.identifier === packetId;
    const resolver = () => {};

    return this.createRequest(packet, matcher, resolver, 10);
  }

  /**
   * Creates a request by sending a packet and waiting for a matching response packet.
   * @param packet - The packet to send.
   * @param matcher - A function that checks if a received packet matches the expected response.
   * @param resolver - A function that extracts the desired result from the received response packet.
   * @param timeout_s - The timeout in seconds for waiting for the response packet.
   * @returns A promise that resolves with the result extracted from the response packet or rejects with an error if the timeout is reached.
   */
  private async createRequest<TResponse extends AnyPacketV4, TResult>(
    packet: AnyPacketV4,
    matcher: (response: TResponse) => boolean,
    resolver: (response: TResponse) => TResult,
    timeout_s: number
  ): Promise<TResult> {
    return new Promise((resolve, reject) => {
      const packetId = this.packetIdManager.allocateIdentifier();

      const cleanup = () => {
        clearTimeout(timeout);
        this.transport.off("packetReceived", waitForPacket); // remove listener for this packet
        this.packetIdManager.releaseIdentifier(packetId); // release the allocated packet identifier
      };

      const waitForPacket = (receivedPacket: TResponse) => {
        if (!matcher(receivedPacket)) {
          return;
        }

        // if the received packet is the expected packet
        cleanup();
        resolve(resolver(receivedPacket));
      };

      const timeout = setTimeout(() => {
        // if the expected packet is not received in defined time
        cleanup();
        reject(new AppError("timeout"));
      }, timeout_s * 1000);

      this.transport.on("packetReceived", waitForPacket);
      this.sendPacket(packet);
    });
  }

  private sendPacket = (packet: AnyPacketV4) => {
    this.transport.send(packet);
  };

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
