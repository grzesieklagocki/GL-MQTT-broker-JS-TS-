import { AnyPacket } from "@mqtt/protocol/shared/types";
import {
  IMqttPacketCodec,
  IMqttSocketTransportAdapter,
} from "@mqtt/shared/types";

// re-exported here so existing client-side imports keep working unchanged;
// the canonical definition now lives in @mqtt/shared/types, since it is also
// used outside of the client (e.g. by MqttPacketCodecV4).
export type { IMqttPacketCodec };

/**
 * Interface for a transport adapter that handles MQTT packets of a specific type and that
 * establishes the underlying connection itself (e.g. by dialing out to a broker). For an
 * adapter that instead works with an already-established connection, see
 * IMqttSocketTransportAdapter in @mqtt/shared/types.
 */
export interface IMqttTransportAdapter<
  TPacket extends AnyPacket,
> extends IMqttSocketTransportAdapter<TPacket> {
  /**
   * Connects to the transport layer (e.g. TCP)
   */
  connect(): Promise<void>;
}

/**
 * Enum representing the connection status of an MQTT client.
 */
export type ConnectionStatus =
  | "DISCONNECTED" // The client is not connected to the broker.
  | "CONNECTING" // The client is in the process of establishing a connection to the broker.
  | "CONNECTED"; // The client is successfully connected to the broker.
