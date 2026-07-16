import { EventEmitter } from "events";
import { Socket } from "net";
import { IMqttTransportAdapterV4 } from "./types";
import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { IMqttPacketCodec, IMqttTransportAdapterEvents } from "../shared/types";
import { AppError } from "@src/AppError";

/**
 * Implementation of the IMqttTransportAdapterV4 interface that handles MQTT V4 packets.
 */

export class MqttTransportAdapterV4 implements IMqttTransportAdapterV4 {
  private socket?: Socket;
  private readonly events = new EventEmitter();

  private _isActive = false;

  /**
   * Indicates whether the transport adapter is currently connected.
   */
  public get isActive(): boolean {
    return this._isActive;
  }

  //
  // constructor
  //

  /**
   * Creates an instance of MqttTransportAdapterV4.
   * @param codec - The codec used for encoding and decoding MQTT packets.
   * @param createSocket - A function that creates a new socket instance.
   * @param host - The host address to connect to.
   */
  constructor(
    private readonly codec: IMqttPacketCodec<AnyPacketV4>,
    private readonly createSocket: () => Socket,
    private readonly host: string,
    private readonly port: number
  ) {}

  //
  // private methods
  //

  /**
   * Connects to the transport layer (e.g. TCP or TLS).
   */
  public connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.isActive)
        reject(new AppError("Transport adapter is already connected."));

      const socket = this.createSocket();
      this.socket = socket;

      const removeConnectionListeners = () => {
        socket.off("connect", onConnect);
        socket.off("close", onClose);
        socket.off("error", onError);
      };

      const rejectConnection = (error: Error) => {
        removeConnectionListeners();

        this.socket = undefined;

        reject(error);
      };

      const onConnect = () => {
        removeConnectionListeners();

        this._isActive = true;

        resolve();
      };

      const onClose = () => {
        rejectConnection(
          new AppError("Socket closed.")
        );
      };

      const onError = (error: Error) => {
        rejectConnection(error);
      };

      socket.once("connect", onConnect);
      socket.once("close", onClose);
      socket.once("error", onError);

      socket.connect(this.port, this.host);
    });
  }

  /**
   * Sends a packet to the transport layer.
   * @param packet - The MQTT packet to be sent.
   */
  public async send(packet: AnyPacketV4): Promise<void> {
    throw new Error("Method not implemented.");
  }

  /**
   * Disconnects the transport layer (e.g. TCP) and will emit the "disconnected" event with provided (optional) error.
   * @param error - Optional error that caused the disconnect.
   */
  public async disconnect(error?: Error): Promise<void> {
    throw new Error("Method not implemented.");
  }

  //
  // events
  //

  /**
   * Registers an event listener for a specific event emitted by the transport adapter.
   * @param eventName - The name of the event to listen for.
   * @param listener - The callback function to be invoked when the event occurs.
   */
  public on<EventName extends keyof IMqttTransportAdapterEvents>(
    eventName: EventName,
    listener: (...args: IMqttTransportAdapterEvents[EventName]) => void
  ) {
    this.events.on(eventName, listener);
  }

  /**
   * Registers a one-time event listener for a specific event emitted by the MQTT client. The listener will be invoked only once and then removed.
   * @param eventName - The name of the event to listen for.
   * @param listener 1- The callback function to be invoked when the event occurs.
   */
  public once<EventName extends keyof IMqttTransportAdapterEvents>(
    eventName: EventName,
    listener: (...args: IMqttTransportAdapterEvents[EventName]) => void
  ): void {
    this.events.once(eventName, listener);
  }

  /**
   * Removes an event listener for a specific event emitted by the MQTT client.
   * @param eventName - The name of the event for which the listener should be removed.
   * @param listener - The callback function that was previously registered as a listener for the event.
   */
  public off<EventName extends keyof IMqttTransportAdapterEvents>(
    eventName: EventName,
    listener: (...args: IMqttTransportAdapterEvents[EventName]) => void
  ): void {
    this.events.off(eventName, listener);
  }

  /**
   * Emits an event with the specified name and arguments to all registered listeners for that event.
   * @param event - The name of the event to emit.
   * @param args - The arguments to pass to the event listeners.
   * @returns A boolean indicating whether the event had listeners and was successfully emitted.
   */
  private emit<EventName extends keyof IMqttTransportAdapterEvents>(
    event: EventName,
    ...args: IMqttTransportAdapterEvents[EventName]
  ): boolean {
    return this.events.emit(event, ...args);
  }
}
