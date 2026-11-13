import { Socket } from "node:net";
import { AnyPacket } from "@mqtt/protocol/shared/types";
import { IMqttPacketCodec, IMqttSocketTransportAdapter } from "./types";
import { AppError } from "@src/AppError";

/**
 * Base implementation of IMqttSocketTransportAdapter that manages an already-established
 * socket: it encodes/decodes packets through a codec and relays data between the socket
 * and the packet handlers. It does not establish the connection itself, so it can be used
 * both by clients, after dialing out (see MqttTransportAdapterV4), and by servers, with a
 * socket accepted from an incoming connection.
 */
export class MqttSocketTransportAdapter<
  TPacket extends AnyPacket,
> implements IMqttSocketTransportAdapter<TPacket> {
  /**
   * Socket used for communication.
   * It is undefined when the adapter has no socket attached.
   */
  protected socket?: Socket;

  /**
   * Indicates whether the transport adapter currently has a socket attached.
   */
  public get isActive(): boolean {
    return this.socket !== undefined;
  }

  //
  // constructor
  //

  /**
   * Creates an instance of MqttSocketTransportAdapter.
   * @param codec - The codec used for encoding and decoding MQTT packets.
   * @param socket - An already-established socket to attach immediately (e.g. one accepted by a server). If omitted, a subclass is expected to attach a socket later (e.g. after dialing out).
   */
  constructor(
    protected readonly codec: IMqttPacketCodec<TPacket>,
    socket?: Socket
  ) {
    codec.packetDecodedHandler = this.handlePacket;

    if (socket) this.attachSocket(socket);
  }

  //
  // public methods
  //

  /**
   * Sends a packet to the transport layer.
   * @param packet - The MQTT packet to be sent.
   */
  public async send(packet: TPacket): Promise<void> {
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
   * Callback function to be invoked when an MQTT packet is received from the transport layer.
   * @param packet - The MQTT packet that was received from the transport layer.
   */
  public packetReceivedHandler: (packet: TPacket) => void = () => {
    throw new Error("packetReceivedHandler callback is not set.");
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

  /**
   * Attaches a socket to this adapter, making it active: stores the reference and starts listening for its events.
   * @param socket - The already-established socket to attach.
   */
  protected attachSocket(socket: Socket) {
    this.socket = socket;
    this.addSocketListeners(socket);
  }

  protected addSocketListeners(socket: Socket) {
    socket.on("data", this.receiveBytes);
    socket.on("close", this.disconnect);
    socket.on("error", this.disconnect);
  }

  protected removeSocketListeners(socket: Socket) {
    socket.off("data", this.receiveBytes);
    socket.off("close", this.disconnect);
    socket.off("error", this.disconnect);
  }

  private receiveBytes = (bytes: Uint8Array) => {
    this.codec.feed(bytes);
  };

  private handlePacket = (packet: TPacket) => {
    try {
      this.packetReceivedHandler(packet);
    } catch (error) {
      this.disconnect(error as Error);
      throw error;
    }
  };
}
