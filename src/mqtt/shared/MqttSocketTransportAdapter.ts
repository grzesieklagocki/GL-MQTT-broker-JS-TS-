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
  private disconnectPromise?: Promise<void>; // Promise that resolves when the transport is fully disconnected and cleaned up.
  protected resolveDisconnect?: () => void; // Function to resolve the disconnectPromise when cleanup is complete.
  private closeError?: Error; // Error that caused the transport to close, if any.

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
    if (
      !this.isActive ||
      this.socket?.connecting ||
      this.disconnectPromise ||
      this.closeError
    )
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
   * Closes the transport and resolves after the socket closes and cleanup completes.
   * @param error - Optional error that caused the disconnect.
   */
  public disconnect = (error?: Error): Promise<void> => {
    if (this.disconnectPromise) return this.disconnectPromise;
    if (!this.socket)
      return Promise.reject(
        new AppError("Transport adapter is not connected.")
      );

    const socket = this.socket;
    this.closeError ??= error;
    this.disconnectPromise = new Promise<void>((resolve) => {
      this.resolveDisconnect = resolve;
    });

    if (error || socket.connecting) socket.destroy(error);
    else socket.end(() => socket.destroy());

    return this.disconnectPromise;
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
    this.registerSocket(socket);
    this.addSocketListeners(socket);
  }

  protected registerSocket(socket: Socket) {
    this.disconnectPromise = undefined;
    this.resolveDisconnect = undefined;
    this.closeError = undefined;
    this.socket = socket;
  }

  protected addSocketListeners(socket: Socket) {
    socket.on("data", this.receiveBytes);
    socket.on("close", this.handleSocketClose);
    socket.on("error", this.handleSocketError);
  }

  protected removeSocketListeners(socket: Socket) {
    socket.off("data", this.receiveBytes);
    socket.off("close", this.handleSocketClose);
    socket.off("error", this.handleSocketError);
  }

  private handleSocketError = (error: Error) => {
    this.closeError ??= error;
  };

  private handleSocketClose = (hadError: boolean) => {
    if (!this.socket) return;

    const error =
      this.closeError ??
      (hadError
        ? new AppError("Socket closed after a transmission error.")
        : undefined);
    const resolveDisconnect = this.resolveDisconnect;

    this.removeSocketListeners(this.socket);
    this.socket = undefined;
    this.disconnectPromise ??= Promise.resolve();
    this.codec.resetState();

    try {
      this.disconnectHandler(error);
    } finally {
      resolveDisconnect?.();
    }
  };

  private receiveBytes = (bytes: Uint8Array) => {
    if (this.disconnectPromise || this.closeError) return;

    try {
      this.codec.feed(bytes);
    } catch (error) {
      void this.disconnect(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  };

  private handlePacket = (packet: TPacket) => {
    if (this.disconnectPromise || this.closeError) return;

    try {
      this.packetReceivedHandler(packet);
    } catch (error) {
      this.disconnect(error as Error);
      throw error;
    }
  };
}
