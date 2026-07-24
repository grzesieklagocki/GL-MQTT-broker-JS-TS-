import { AnyPacketV4, ConnackReturnCodeV4 } from "@mqtt/protocol/v4/types";
import { IMqttTransportAdapter } from "../shared/types";

/**
 * Interface for a transport adapter that handles MQTT V4 packets.
 */
export type IMqttTransportAdapterV4 = IMqttTransportAdapter<AnyPacketV4>;

export type MqttClientEvents = {
  publish: [topic: string, payload?: Uint8Array];
  disconnect: [error?: Error];
};

export type PingTimeoutAction = "SET" | "CLEAR" | "RESET";

export type ConnectResponse = {
  returnCode: ConnackReturnCodeV4;
  sessionPresent: boolean;
  clientIdentifier: string;
};
