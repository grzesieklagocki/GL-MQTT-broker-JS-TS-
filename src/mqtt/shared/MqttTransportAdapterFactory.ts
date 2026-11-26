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
   * @param role - The role of the transport adapter, can be "client", "broker", or "both". Defaults to "both".
   * @returns An instance of MqttTransportAdapterV4 configured for TCP transport.
   */
  public static createTcp(
    host: string,
    port: number,
    role: "client" | "broker" | "both" = "both"
  ) {
    let flow: "both" | "brokerToClient" | "clientToBroker";

    switch (role) {
      case "client":
        flow = "brokerToClient";
        break;
      case "broker":
        flow = "clientToBroker";
        break;
      case "both":
        flow = "both";
        break;
    }

    return new MqttTransportAdapterV4(
      new MqttPacketCodecV4(flow),
      () => new Socket(),
      host,
      port
    );
  }
}
