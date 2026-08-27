import { Socket } from "net";
import { MqttTransportAdapterV4 } from "../client/v4/MqttTransportAdapterV4";
import { MqttPacketCodecV4 } from "./MqttPacketCodecV4";

/**
 * Factory class for creating instances of MqttTransportAdapter.
 */
export class MqttTransportAdapterFactory {
  /**
   * Creates a new instance of MqttTransportAdapterV4 using TCP transport.
   * @param host - The host address to connect to.
   * @param port - The port number to connect to.
   * @returns An instance of MqttTransportAdapterV4 configured for TCP transport.
   */
  public static createTcp = (host: string, port: number) =>
    new MqttTransportAdapterV4(
      new MqttPacketCodecV4(),
      () => new Socket(),
      host,
      port
    );
}
