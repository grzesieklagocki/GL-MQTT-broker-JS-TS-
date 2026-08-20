import { EventEmitter } from "node:events";
import { Socket } from "node:net";
import { IMqttTransportAdapterV4 } from "./types";
import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { IMqttPacketCodec } from "../shared/types";
import { AppError } from "@src/AppError";

/**
 * Implementation of the IMqttTransportAdapterV4 interface that handles MQTT V4 packets.
 */
export class MqttTransportAdapterV4 implements IMqttTransportAdapterV4 {
  /**
   * Socket used for communication.
   * It is undefined when the adapter is not connected.
   */
  private socket?: Socket;

  /**
   * Indicates whether the transport adapter is currently connected.
   */
  public get isActive(): boolean {
    return this.socket !== undefined;
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

        this.addSocketListeners(socket);

        resolve();
      };

      const onClose = () => {
        rejectConnection(new AppError("Socket closed."));
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
    if (!this.isActive)
      throw new AppError("Transport adapter is not connected.");
  }

  /**
   * Disconnects the transport layer (e.g. TCP) and will emit the "disconnected" event with provided (optional) error.
   * @param error - Optional error that caused the disconnect.
   */
  public async disconnect(error?: Error): Promise<void> {
    if (!this.isActive)
      throw new AppError("Transport adapter is not connected.");

    const socket = this.socket!; // asserted because isActive check ensure that socket is defined
    this.socket = undefined; // clear the socket reference to indicate that the adapter not active

    this.removeSocketListeners(socket);
    this.onDisconnect(error);

    return new Promise<void>((resolve) => {
      if (error) {
        socket.destroy(error);
        resolve();
      } else
        socket.end(
          // wait for the socket to close before resolving
          () => {
            resolve();
          }
        );
    });
  }

  //
  // events
  //

  /**
   * Callback function to be invoked when a packet is received from the transport layer.
   * @param packet - The MQTT packet that was received.
   * @returns True if the packet was handled successfully, or an Error if there was an issue processing the packet.
   */
  public onPacketReceived: (packet: AnyPacketV4) => true | Error = () => {
    throw new Error("onPacketReceived callback is not set.");
  };

  /**
   * Callback function to be invoked when the transport layer is disconnected.
   * @param error - Optional error that caused the disconnect.
   */
  public onDisconnect: (error?: Error) => void = () => {
    throw new Error("onDisconnect callback is not set.");
  };

  //
  // helpers
  //
  private addSocketListeners(socket: Socket) {
    socket.on("data", this.tryDecodeAndSendPacket);
    socket.on("close", this.handleDisconnect);
    socket.on("error", this.handleDisconnect);
  }

  private removeSocketListeners(socket: Socket) {
    socket.off("data", this.tryDecodeAndSendPacket);
    socket.off("close", this.handleDisconnect);
    socket.off("error", this.handleDisconnect);
  }

  private handleDisconnect(error?: Error) {
    throw new Error("Method not implemented.");
  }

  private tryDecodeAndSendPacket = (bytes: Uint8Array) => {
    throw new Error("Method not implemented.");
  };
}
