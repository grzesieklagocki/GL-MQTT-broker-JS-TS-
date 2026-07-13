import { AppError } from "@src/AppError";
import { IMqttTransportAdapterV4 } from "./types";
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
  /**
   * Indicates whether the MQTT client is currently connected to the broker.
   */
  public get isConnected(): boolean {
    return this.getConnectionStatus() === ConnectionStatus.CONNECTED;
  }

  /**
   * Gets the current connection status of the MQTT client.
   * @returns The current connection status, which can be CONNECTED, DISCONNECTED, or CONNECTING.
   */
  public getConnectionStatus = () => {
    return this.mqttConnectionStatus;
  };

  // Sets the connection status of the MQTT client.
  private setConectionStatus(status: ConnectionStatus) {
    this.mqttConnectionStatus = status;
  }

  // The current connection status of the MQTT client. Initialized to DISCONNECTED.
  private mqttConnectionStatus: ConnectionStatus =
    ConnectionStatus.DISCONNECTED;

  /**
   * Creates an instance of ClientV4.
   * @param transport - The transport adapter responsible for sending and receiving MQTT packets.
   * @param packetIdManager - The packet identifier manager responsible for generating unique packet identifiers.
   */
  public constructor(
    private readonly transport: IMqttTransportAdapterV4,
    private readonly packetIdManager: IPacketIdentifierManager
  ) {
    super();

    // register events

    this.transport.on("packetReceived", (packet) => {
      this.handleReceivedPacket(packet);
    });

    this.transport.on("disconnect", (error) => this.handleDisconnect(error));
  }

  public async connect(
    clientIdentifier: string,
    auth?: MqttAuth,
    will?: Will,
    keepAlive: number = 60,
    cleanSession: boolean = true
  ): Promise<{
    returnCode: ConnackReturnCodeV4;
    sessionPresent: boolean;
  }> {
    this._assertClientDisconnected();

    try {
      await this.waitForTransport(() => this.transport.connect(), 5);
    } catch (error) {
      throw new AppError("Connection failed -> " + (error as Error).message);
    }

    const packet = MqttPacketV4Factory.createConnectPacketV4(
      cleanSession,
      keepAlive,
      clientIdentifier,
      auth?.user,
      auth?.password,
      will
    );

    const selector = (response: AnyPacketV4) =>
      response.typeId === PacketType.CONNACK ? response : undefined;

    const resolver = (response: ConnackPacketV4) => {
      //set the connection status based on the return code from the CONNACK packet
      this.setConectionStatus(
        response.connectReturnCode === ConnackReturnCodeV4.CONNECTION_ACCEPTED
          ? ConnectionStatus.CONNECTED
          : ConnectionStatus.DISCONNECTED
      );

      return {
        returnCode: response.connectReturnCode,
        sessionPresent: response.sessionPresentFlag,
      };
    };

    // set the connection status to connecting before sending the connect packet
    this.mqttConnectionStatus = ConnectionStatus.CONNECTING;

    const waitForResponse = this.waitForResponse(
      packet,
      selector,
      resolver,
      10
    );

    waitForResponse.catch(() => {
      // if the connection fails set the status back to disconnected
      this.setConectionStatus(ConnectionStatus.DISCONNECTED);
    });

    return await waitForResponse;
  }

  /**
   * Subscribes to a list of topics and returns the corresponding return codes from the broker.
   * @param subscriptionList - The list of topics to subscribe to, along with their requested QoS levels.
   * @returns A promise that resolves with an array of return codes indicating the result of each subscription request.
   */
  public async subscribe(
    subscriptionList: SubscriptionV4[]
  ): Promise<SubackReturnCodeV4[]> {
    this._assertClientConnected();

    const packetId = this.packetIdManager.allocateIdentifier();
    const packet = MqttPacketV4Factory.createSubscribePacketV4(
      packetId,
      subscriptionList
    );

    const selector = (response: AnyPacketV4) =>
      response.typeId === PacketType.SUBACK && response.identifier === packetId
        ? response
        : undefined;

    const resolver = (response: SubackPacketV4) => response.returnCodeList;

    return await this.waitForResponse(packet, selector, resolver, 10);
  }

  /**
   * Unsubscribes from a list of topics.
   * @param topicFilterList - The list of topic filters to unsubscribe from.
   * @returns A promise that resolves when the unsubscription is successful or rejects with an error if the timeout is reached.
   */
  public async unsubscribe(topicFilterList: string[]): Promise<void> {
    this._assertClientConnected();

    const packetId = this.packetIdManager.allocateIdentifier();
    const packet = MqttPacketV4Factory.createUnsubscribePacketV4(
      packetId,
      topicFilterList
    );

    const selector = (response: AnyPacketV4) =>
      response.typeId === PacketType.UNSUBACK &&
      response.identifier === packetId
        ? response
        : undefined;

    const resolver = () => {};

    await this.waitForResponse(packet, selector, resolver, 10);
  }

  public async disconnect(): Promise<void> {
    this._assertClientConnected();

    await this.handleDisconnect();
  }

  //
  // helpers
  //

  /**
   * Waits for a specific response packet from the broker after sending a request packet.
   * @param packet - The packet to send.
   * @param responseSelector - A function that checks if a received packet matches the expected response packet and if so, returns the response packet.
   * @param resolver - A function that extracts the desired result from the received response packet.
   * @param timeout_s - The timeout in seconds for waiting for the response packet.
   * @returns A promise that resolves with the result extracted from the response packet or rejects with an error if the timeout is reached.
   */
  private waitForResponse<TResponse extends AnyPacketV4, TResult>(
    packet: AnyPacketV4,
    responseSelector: (response: AnyPacketV4) => TResponse | undefined,
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

      const waitForPacket = (receivedPacket: AnyPacketV4) => {
        const response = responseSelector(receivedPacket);

        if (!response) return;

        // if the received packet is the expected packet
        cleanup();
        resolve(resolver(response));
      };

      const timeout = setTimeout(() => {
        // if the expected packet is not received in defined time
        cleanup();
        reject(
          new AppError(
            `timeout: MQTT client did not receive expected packet within ${timeout_s} seconds.`
          )
        );
      }, timeout_s * 1000);

      this.transport.on("packetReceived", waitForPacket);
      this.sendPacket(packet);
    });
  }

  private async waitForTransport<T>(
    operation: () => Promise<T>,
    timeout_s: number,
    timeoutMessage = `timeout: transport adapter did not respond within ${timeout_s} seconds.`
  ): Promise<T> {
    let timeout: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new AppError(timeoutMessage));
      }, timeout_s * 1000);
    });

    try {
      const operationPromise = operation();

      return await Promise.race([operationPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeout!);
    }
  }

  private sendPacket = async (packet: AnyPacketV4) => {
    try {
      await this.waitForTransport(() => this.transport.send(packet), 5);
    } catch (error) {
      await this.handleDisconnect(error as Error);
    }
  };

  //
  // handlers
  //

  /**
   * Handles a received MQTT packet and sends response if necessary.
   * @param packet - The received MQTT packet.
   */
  private async handleReceivedPacket(packet: AnyPacketV4) {
    let response: AnyPacketV4 | undefined;

    switch (packet.typeId) {
      case PacketType.PUBLISH:
        response = await this.handlePublishPacketReceived(packet);
        break;

      case PacketType.PUBREC:
      case PacketType.PUBREL:
      case PacketType.PUBCOMP:
        // TODO: QoS 2
        break;

      case PacketType.CONNACK:
      case PacketType.PUBACK:
      case PacketType.SUBACK:
      case PacketType.UNSUBACK:
      case PacketType.PINGRESP:
        // ignore, should to be handled by the createRequest method
        break;

      default:
        await this.handleDisconnect(
          new AppError(
            `Client received disallowed packet type: ${PacketType[packet.typeId]}`
          )
        );
    }

    if (response) await this.sendPacket(response);
  }

  private async handlePublishPacketReceived(
    packet: PublishPacketV4
  ): Promise<AnyPacketV4 | undefined> {
    if (packet.flags.qosLevel == 2) {
      const error = new AppError("QOS 2 is currently not supported.");

      await this.handleDisconnect(error);
    }

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
  private async handleDisconnect(error?: Error) {
    this.setConectionStatus(ConnectionStatus.DISCONNECTED);

    if (!error) {
      // clean disconnect

      const packet = MqttPacketV4Factory.createSimplePacketV4(
        PacketType.DISCONNECT
      );

      await this.sendPacket(packet); // send disconnect packet to broker

      try {
        await this.waitForTransport(
          () => this.transport.disconnect(),

          5
        ); // disconnect the transport layer (e.g., close TCP connection)
      } catch (error) {
        error = new AppError(
          "Transport disconnection failed: ",
          error as Error
        );
      }
    }

    this.emit("disconnect", error);
  }

  //
  // assertions
  //

  /**
   * Asserts that the MQTT client is currently connected.
   */
  private _assertClientConnected() {
    if (!this.isConnected)
      throw new AppError(
        `Client is not connected. Current status: ${ConnectionStatus[this.mqttConnectionStatus]}`
      );
  }

  private _assertClientDisconnected() {
    if (this.getConnectionStatus() !== ConnectionStatus.DISCONNECTED)
      throw new AppError(
        `Client is not disconnected. Current status: ${ConnectionStatus[this.mqttConnectionStatus]}`
      );
  }
}
