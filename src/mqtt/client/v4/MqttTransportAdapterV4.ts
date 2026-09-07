import { Socket } from "node:net";
import { IMqttTransportAdapterV4 } from "./types";
import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { IMqttPacketCodec } from "../shared/types";
import { AppError } from "@src/AppError";
import { PacketType } from "@mqtt/protocol/shared/types";

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
  ) {
    codec.packetReadyHandler = this.handlePacket;
  }

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

    let bytes; // for encoding the packet to bytes

    try {
      bytes = this.codec.encode(packet);
    } catch (error) {
      throw new AppError("Encoding error", error as Error);
    }

    try {
      this.socket!.write(bytes); // asserted because isActive check ensure that socket is defined
    } catch (error) {
      throw new AppError("Transport error", error as Error);
    }
  }

  /**
   * Disconnects the transport layer (e.g. TCP) and will emit the "disconnected" event with provided (optional) error.
   * @param error - Optional error that caused the disconnect.
   */
  public disconnect = async (error?: Error): Promise<void> => {
    if (!this.isActive)
      throw new AppError("Transport adapter is not connected.");

    const socket = this.socket!; // asserted because isActive check ensure that socket is defined
    this.socket = undefined; // clear the socket reference to indicate that the adapter not active

    this.removeSocketListeners(socket);
    this.disconnectHandler(error); // invoke callback

    this.codec.resetState();

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
  };

  //
  // events
  //

  /**
   * Callback function to be invoked when a packet is framed and ready to be decoded.
   * @param packetType - The type of the MQTT packet that was framed.
   * @param decodePacket - A function that, when called, will decode the framed packet into an MQTT packet of type TPacket.
   * @returns true if the packet was successfully handled, or an Error if there was an issue.
   */
  public packetReadyHandler: (
    packetType: PacketType,
    decodePacket: () => AnyPacketV4
  ) => void = () => {
    throw new Error("packetReadyHandler callback is not set.");
  };

  /**
   * Callback function to be invoked when the transport layer is disconnected.
   * @param error - Optional error that caused the disconnect.
   */
  public disconnectHandler: (error?: Error) => void = () => {
    throw new Error("disconnectHandler callback is not set.");
  };

  //
  // helpers
  //

  private addSocketListeners(socket: Socket) {
    socket.on("data", this.receiveBytes);
    socket.on("close", this.disconnect);
    socket.on("error", this.disconnect);
  }

  private removeSocketListeners(socket: Socket) {
    socket.off("data", this.receiveBytes);
    socket.off("close", this.disconnect);
    socket.off("error", this.disconnect);
  }

  private receiveBytes = (bytes: Uint8Array) => {
    this.codec.feed(bytes);
  };

  private handlePacket = (
    packetType: PacketType,
    decodePacket: () => AnyPacketV4
  ) => {
    try {
      this.packetReadyHandler(packetType, decodePacket);
    } catch (error) {
      this.disconnect(error as Error);
      throw error;
    }
  };
}
