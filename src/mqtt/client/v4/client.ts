import { AppError } from "@src/AppError";
import {
  ConnectResponse,
  IMqttTransportAdapterV4,
  MqttClientEvents,
  PingTimeoutAction,
} from "./types";
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
  PublishFlagsV4,
  PublishPacketV4,
  SubackPacketV4,
  SubackReturnCodeV4,
  SubscriptionV4,
} from "@mqtt/protocol/v4/types";
import { EventEmitter } from "node:events";
import { generateRandomClientId } from "../../shared/generateRandomClientId";
import { performActionWithTimeout } from "@mqtt/shared/performActionWithTimeout";

/**
 * Represents an MQTT client that implements the MQTT 3.1.1 (protocol version 4).
 */
export class MqttClientV4 {
  /**
   * Indicates whether the MQTT client is currently connected to the broker.
   */
  public get isConnected(): boolean {
    return this.getConnectionStatus() === "CONNECTED";
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
  private mqttConnectionStatus: ConnectionStatus = "DISCONNECTED";

  private pingTimeoutId?: NodeJS.Timeout; // used for keep-alive mechanism
  private keepAlive_s: number = 0;

  private waitForConnack: {
    resolve?: (resolve: ConnackPacketV4) => void;
    reject?: (resolve: ConnackPacketV4) => void;
  } = {};

  private waitForPingresp = {
    resolve: () => {},
    reject: () => {},
  };

  private readonly events = new EventEmitter();

  //
  // constructor
  //

  /**
   * Creates an instance of ClientV4.
   * @param transport - The transport adapter responsible for sending and receiving MQTT packets.
   * @param packetIdManager - The packet identifier manager responsible for generating unique packet identifiers.
   */
  public constructor(
    private readonly transport: IMqttTransportAdapterV4,
    private readonly packetIdManager: IPacketIdentifierManager
  ) {
    // register events

    this.transport.on("packetReceived", (packet) => {
      this.handleReceivedPacket(packet);
    });

    this.transport.on("disconnect", (error) => this.handleDisconnect(error));
  }

  //
  // events
  //

  /**
   * Registers an event listener for a specific event emitted by the MQTT client.
   * @param event - The name of the event to listen for.
   * @param listener - The callback function to be invoked when the event occurs.
   */
  public on<EventName extends keyof MqttClientEvents>(
    event: EventName,
    listener: (...args: MqttClientEvents[EventName]) => void
  ) {
    this.events.on(event, listener);
  }

  /**
   * Removes an event listener for a specific event emitted by the MQTT client.
   * @param event - The name of the event for which the listener should be removed.
   * @param listener - The callback function that was previously registered as a listener for the event.
   */
  public off<EventName extends keyof MqttClientEvents>(
    event: EventName,
    listener: (...args: MqttClientEvents[EventName]) => void
  ) {
    this.events.off(event, listener);
  }

  /**
   * Registers a one-time event listener for a specific event emitted by the MQTT client. The listener will be invoked only once and then removed.
   * @param event - The name of the event to listen for.
   * @param listener - The callback function to be invoked when the event occurs.
   */
  public once<EventName extends keyof MqttClientEvents>(
    event: EventName,
    listener: (...args: MqttClientEvents[EventName]) => void
  ) {
    this.events.once(event, listener);
  }

  //
  // public methods
  //

  /**
   * Connects to the MQTT broker with the specified parameters and returns the connection result.
   * @param clientIdentifie - The unique identifier for the MQTT client. If not provided, a random client identifier will be generated.
   * @param auth - Optional authentication credentials (username and password) for the MQTT broker.
   * @param will - Optional last will message to be sent by the broker if the client disconnects unexpectedly.
   * @param keepAlive - The keep-alive interval in seconds, which specifies how often the client should send a ping to the broker to maintain the connection.
   * @param cleanSession - A boolean indicating whether to start a clean session (true) or resume a previous session (false).
   * @returns A promise that resolves with an object containing the return code from the broker, a flag indicating whether a previous session is present and the client identifier used for the connection.
   * @throws AppError if the connection fails or if the client is not disconnected before attempting to connect.
   */
  public async connect(
    clientIdentifier?: string,
    auth?: MqttAuth,
    will?: Will,
    keepAlive: number = 60,
    cleanSession: boolean = true
  ): Promise<ConnectResponse> {
    this._assertClientDisconnected();
    // set the connection status to connecting before sending the connect packet
    this.mqttConnectionStatus = "CONNECTING";

    this.keepAlive_s = keepAlive;

    try {
      await this.waitForTransport(() => this.transport.connect(), 5);
    } catch (error) {
      this.setConectionStatus("DISCONNECTED");

      throw new AppError("Connection failed -> " + (error as Error).message);
    }

    if (clientIdentifier === undefined)
      clientIdentifier = generateRandomClientId();

    const packet = MqttPacketV4Factory.createConnectPacketV4(
      cleanSession,
      keepAlive,
      clientIdentifier,
      auth?.user,
      auth?.password,
      will
    );

    const action = async () => {
      const waitForConnack = new Promise<ConnectResponse>((resolve) => {
        this.waitForConnack.resolve = (packet) => {
          this.setConectionStatus(
            packet.connectReturnCode === ConnackReturnCodeV4.CONNECTION_ACCEPTED
              ? "CONNECTED"
              : "DISCONNECTED"
          );

          resolve({
            returnCode: packet.connectReturnCode,
            sessionPresent: packet.sessionPresentFlag,
            clientIdentifier,
          });
        };
      });

      await this.sendPacket(packet);
      return waitForConnack;
    };

    const timeoutSeconds = 10;

    return await performActionWithTimeout(
      action,
      timeoutSeconds,
      new Error(
        `timeout: MQTT client did not receive CONNACK packet within ${timeoutSeconds} seconds.`
      )
    ).catch((error) => {
      // if the connection fails set the status back to disconnected
      this.setConectionStatus("DISCONNECTED");
      throw error;
    });
  }

  /**
   * Publishes a message to a specific topic with the given flags and returns a promise that resolves when the publish operation is complete.
   * @param topic - The topic to which the message should be published.
   * @param message - The message payload to be published, represented as a Uint8Array. If not provided, an empty message will be sent.
   * @param flags - Optional flags that specify the quality of service (QoS) level and other publish options.
   * @returns A promise that resolves when the publish operation is complete or rejects with an error if the timeout is reached or if QoS 2 is requested (which is not supported).
   * @throws AppError if the client is not connected or if QoS 2 is requested.
   */
  public async publish(
    topic: string,
    message?: Uint8Array,
    flags?: PublishFlagsV4
  ): Promise<void> {
    this._assertClientConnected();

    const packetId =
      (flags?.qosLevel ?? 0) === 0
        ? undefined // for QoS 0
        : this.packetIdManager.allocateIdentifier(); // for QoS 1 and 2

    const packet = MqttPacketV4Factory.createPublishPacketV4(
      topic,
      message,
      flags,
      packetId
    );

    const qos = flags ? flags.qosLevel : 0;

    switch (qos) {
      case 0:
        return await this.sendPacket(packet);

      case 1:
        const selector = (response: AnyPacketV4) =>
          response.typeId === PacketType.PUBACK &&
          response.identifier === packetId
            ? response
            : undefined;

        return await this.waitForResponse(packet, selector, () => {}, 10);

      case 2:
        throw new AppError("QOS 2 is currently not supported.");
    }
  }

  /**
   * Subscribes to a list of topics and returns the corresponding return codes from the broker.
   * @param subscriptionList - The list of topics to subscribe to, along with their requested QoS levels.
   * @returns A promise that resolves with an array of return codes indicating the result of each subscription request.
   * @throws AppError if the client is not connected or if the subscription operation times out.
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
   * @throws AppError if the client is not connected or if the unsubscription operation times out.
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

    await this.waitForResponse(packet, selector, () => {}, 10);
  }

  public async disconnect(): Promise<void> {
    this._assertClientConnected();

    const packet = MqttPacketV4Factory.createSimplePacketV4(
      PacketType.DISCONNECT
    );

    await this.sendPacket(packet);

    this.handleDisconnect();
  }

  //
  // helpers
  //

  /**
   * Sends a PINGREQ packet to the broker and waits for a PINGRESP packet with the keep-alive timeout.
   */
  private async ping() {
    this._assertClientConnected();

    const packet = MqttPacketV4Factory.createSimplePacketV4(PacketType.PINGREQ);

    const action = async () => {
      const waitForPingresp = new Promise<void>((resolve, reject) => {
        this.waitForPingresp.resolve = resolve;
        this.waitForPingresp.reject = reject;
      });

      await this.sendPacket(packet);
      await waitForPingresp;
    };

    await performActionWithTimeout(
      action,
      this.keepAlive_s,
      new AppError(
        `timeout: MQTT client did not receive PINGRESP packet within ${this.keepAlive_s} seconds.`
      )
    );
  }

  /**
   * Waits for a specific response packet from the broker after sending a request packet.
   * @param packet - The packet to send.
   * @param responseSelector - A function that checks if a received packet matches the expected response packet and if so, returns the response packet.
   * @param resolver - A function that extracts the desired result from the received response packet.
   * @param timeout_s - The timeout in seconds for waiting for the response packet.
   * @returns A promise that resolves with the result extracted from the response packet or rejects with an error if the timeout is reached.
   * @throws AppError if the expected response packet is not received within the specified timeout.
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

      this.transport.once("packetReceived", waitForPacket);
      this.sendPacket(packet);
    });
  }

  /**
   * Waits for a transport operation to complete within a specified timeout period. If the operation does not complete in time, it rejects with an error.
   * @param operation - A function that returns a promise representing the transport operation to be performed.
   * @param timeout_s - The timeout period in seconds for the transport operation.
   * @param timeoutMessage - An optional custom message for the timeout error. If not provided, a default message will be used.
   * @returns A promise that resolves with the result of the transport operation if it completes successfully within the timeout period, or rejects with an error if the operation times out.
   * @throws AppError if the transport operation does not complete within the specified timeout period.
   */
  private waitForTransport = <T>(
    operation: () => Promise<T>,
    timeout_s: number
  ): Promise<T> =>
    performActionWithTimeout(
      operation,
      timeout_s,
      new AppError(
        `timeout: transport adapter did not respond within ${timeout_s} seconds.`
      )
    );

  /**
   * Sends an MQTT packet using the transport adapter and handles any errors that may occur during the sending process.
   * If an error occurs, it triggers the disconnection handling process.
   * Ping timeout is reset after a successful send operation to ensure the keep-alive mechanism is maintained.
   * @param packet - The MQTT packet to be sent.
   * @throws AppError if there is an error while sending the packet or if the transport layer fails to send the packet.
   */
  private sendPacket = async (packet: AnyPacketV4) => {
    try {
      await this.waitForTransport(() => this.transport.send(packet), 5);

      this.pingTimeout("RESET");
    } catch (error) {
      this.handleDisconnect(error as Error);
    }
  };

  /**
   * Emits an event with the specified name and arguments to all registered listeners for that event.
   * @param event - The name of the event to emit.
   * @param args - The arguments to pass to the event listeners.
   * @returns A boolean indicating whether the event had listeners and was successfully emitted.
   */
  private emit<Event extends keyof MqttClientEvents>(
    event: Event,
    ...args: MqttClientEvents[Event]
  ): boolean {
    return this.events.emit(event, ...args);
  }

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
        // CONNACK packet is only allowed while client is in CONNECTING state
        if (this.getConnectionStatus() !== "CONNECTING")
          this.handleDisconnect(
            new AppError(
              "Client received unexpected CONNACK packet. Current status: " +
                this.mqttConnectionStatus
            )
          );

        if (this.waitForConnack.resolve) this.waitForConnack.resolve(packet);

        break;
      case PacketType.PINGRESP:
        this.waitForPingresp.resolve();
        break;

      case PacketType.PUBACK:
      case PacketType.SUBACK:
      case PacketType.UNSUBACK:

      default:
        this.handleDisconnect(
          new AppError(
            `Client received disallowed packet type: ${PacketType[packet.typeId]}`
          )
        );
    }

    if (response) await this.sendPacket(response);
  }

  /**
   * Handles the connection process after receiving a successful CONNACK packet from the broker. It sets the keep-alive interval, updates the connection status to CONNECTED, and initiates the ping timeout mechanism.
   * @param keepAlive - The keep-alive interval in seconds, which specifies how often the client should send a ping to the broker to maintain the connection.
   */
  private handleConnect = () => {
    this.setConectionStatus("CONNECTED");
    //this.transport.on("packetReceived", this.disconnectOnConnack);
  };

  /**
   * Manages the ping timeout mechanism for the MQTT client based on the specified action (SET, CLEAR, RESET).
   * @param action - The action to perform on the ping timeout (SET, CLEAR, RESET).
   */
  private pingTimeout(action: PingTimeoutAction): void {
    let pingTimeout;

    switch (action) {
      case "SET":
        if (this.keepAlive_s === 0) return; // if keepAlive is 0, keep alive mechanism is disabled, so no need to set a ping timeout\

        this.pingTimeoutId = setTimeout(async () => {
          try {
            await this.ping();
          } catch (error) {
            this.handleDisconnect(error as Error);
          }
        }, this.keepAlive_s * 1000);
        break;

      case "CLEAR":
        if (this.pingTimeoutId) {
          clearTimeout(this.pingTimeoutId);
          this.pingTimeoutId = undefined;
        }
        break;

      case "RESET":
        this.pingTimeout("CLEAR");
        this.pingTimeout("SET");
        break;

      default:
        throw new AppError(`Invalid ping timeout action: ${action}`);
    }
  }

  /**
   * Handles a received PUBLISH packet and emits a "publish" event with the topic name and application message.
   * If the QoS level is 1, it returns a PUBACK packet to acknowledge the receipt of the message.
   * If the QoS level is 2, it triggers a disconnection with an error since QoS 2 is not supported.
   * @param packet - The received PUBLISH packet.
   * @returns A promise that resolves with a PUBACK packet if the QoS level is 1, or undefined if the QoS level is 0. If the QoS level is 2, it triggers a disconnection and does not return a response.
   */
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
  private handleDisconnect(error?: Error) {
    if (!this.isConnected) return;

    this.pingTimeout("CLEAR");
    this.setConectionStatus("DISCONNECTED");

    this.emit("disconnect", error);

    try {
      this.transport.disconnect(); // disconnect the transport layer (e.g., close TCP connection)
    } catch (error) {
      error = new AppError("Transport disconnection failed: ", error as Error);
    }
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
        `Client is not connected. Current status: ${this.mqttConnectionStatus}`
      );
  }

  /**
   * Asserts that the MQTT client is currently disconnected.
   */
  private _assertClientDisconnected() {
    if (this.getConnectionStatus() !== "DISCONNECTED")
      throw new AppError(
        `Client is not disconnected. Current status: ${this.mqttConnectionStatus}`
      );
  }
}
