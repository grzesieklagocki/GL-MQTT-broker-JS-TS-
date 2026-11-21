import { AddressInfo, createServer, Server } from "node:net";
import { MqttPacketCodecV4 } from "../shared/MqttPacketCodecV4";
import { MqttSocketTransportAdapter } from "../shared/MqttSocketTransportAdapter";
import { AcceptedConnection, IConnectionListener } from "./types";

/**
 * Represents a TCP listener for MQTT connections.
 */
export class MqttTcpListener implements IConnectionListener {
  private server?: Server;
  private stopPromise?: Promise<void>;

  /**
   * Gets the address information of the TCP listener.
   */
  public get address(): AddressInfo | null {
    const address = this.server?.address();

    return address && typeof address !== "string" ? address : null;
  }

  /**
   * Creates a new instance of the TCP listener with the specified host and port.
   * @param host The host address to bind the TCP listener to.
   * @param port The port number to bind the TCP listener to.
   */
  public constructor(
    private readonly host: string,
    private readonly port: number
  ) {}

  //
  // HANDLERS
  //

  /**
   * Handles new incoming connections to the TCP listener.
   */
  public connectionHandler: (connection: AcceptedConnection) => void = () => {};

  /**
   * Handles the closure of the TCP listener, optionally with an error.
   */
  public closeHandler: (error?: Error) => void = () => {};

  /**
   * Handles the event when the TCP listener starts listening for connections.
   */
  public listeningHandler: () => void = () => {};

  /**
   * Starts the TCP listener.
   */
  public listen(): void {
    if (this.server) throw new Error("TCP listener is already started.");

    // create the TCP server and handle incoming connections
    const server = createServer((socket) => {
      if (this.server !== server || this.stopPromise) {
        socket.destroy();
        return;
      }

      const host = socket.remoteAddress ?? "unknown";
      const address = host.includes(":") ? `[${host}]` : host;
      this.connectionHandler({
        transport: new MqttSocketTransportAdapter(
          new MqttPacketCodecV4(),
          socket
        ),
        info:
          socket.remotePort === undefined
            ? address
            : `${address}:${socket.remotePort}`,
      });
    });

    // set the server instance and initialize stop promise and close error
    this.server = server;
    this.stopPromise = undefined;
    let closeError: Error | undefined;
    const finish = () => {
      if (this.server !== server) return;
      this.server = undefined;
      this.closeHandler(closeError);
    };

    // attach event handlers to the server
    server.once("listening", () => this.listeningHandler());
    server.once("close", finish);
    server.on("error", (error) => {
      if (this.server !== server) return;
      closeError ??= error;
      if (server.listening) void this.stop().catch(finish);
      else if (!this.stopPromise) finish();
    });

    // start listening for incoming connections
    try {
      server.listen(this.port, this.host);
    } catch (error) {
      this.server = undefined;
      throw error;
    }
  }

  /**
   * Stops the TCP listener if it is running.
   * @returns A promise that resolves when the listener has stopped.
   */
  public stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    const server = this.server;
    if (!server) return Promise.resolve();

    this.stopPromise = new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    return this.stopPromise;
  }
}
