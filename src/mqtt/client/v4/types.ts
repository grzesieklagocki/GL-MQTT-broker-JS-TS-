import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { ITransportAdapter } from "../shared/types";

/**
 * Interface for a transport adapter that handles MQTT V4 packets.
 */
export type ITransportAdapterV4 = ITransportAdapter<AnyPacketV4>;
