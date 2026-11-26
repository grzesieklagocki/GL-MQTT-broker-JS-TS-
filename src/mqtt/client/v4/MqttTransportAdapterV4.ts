import { Socket } from "node:net";
import { IMqttTransportAdapterV4 } from "./types";
import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { IMqttPacketCodec } from "@mqtt/shared/types";
import { MqttSocketTransportAdapter } from "@mqtt/shared/MqttSocketTransportAdapter";
import { AppError } from "@src/AppError";

/**
 * Implementation of the IMqttTransportAdapterV4 interface that handles MQTT V4 packets.
 * Extends MqttSocketTransportAdapter to open its own socket connection (via connect() method).
 */
export class MqttTransportAdapterV4
  extends MqttSocketTransportAdapter<AnyPacketV4>
  implements IMqttTransportAdapterV4
{
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
    codec: IMqttPacketCodec<AnyPacketV4>,
    private readonly createSocket: () => Socket,
    private readonly host: string,
    private readonly port: number
  ) {
    super(codec);
  }

  //
  // public methods
  //

  /**
   * Connects to the transport layer (e.g. TCP or TLS).
   */
  public connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.isActive) {
        reject(new AppError("Transport adapter is already connected."));
        return;
      }

      const socket = this.createSocket();
      this.registerSocket(socket);

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
        if (this.resolveDisconnect) return;
        removeConnectionListeners();

        this.addSocketListeners(socket);

        resolve();
      };

      const onClose = () => {
        rejectConnection(new AppError("Socket closed."));
        this.resolveDisconnect?.();
      };

      const onError = (error: Error) => {
        // A pending disconnect still needs the close listener to complete.
        if (this.resolveDisconnect) {
          reject(error);
          return;
        }
        rejectConnection(error);
      };

      socket.once("connect", onConnect);
      socket.once("close", onClose);
      socket.once("error", onError);

      socket.connect(this.port, this.host);
    });
  }
}
