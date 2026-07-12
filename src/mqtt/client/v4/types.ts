import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { IMqttTransportAdapter } from "../shared/types";

/**
 * Interface for a transport adapter that handles MQTT V4 packets.
 */
export type IMqttTransportAdapterV4 = IMqttTransportAdapter<AnyPacketV4>;
