import { AnyPacket, FixedHeader, IMqttPacketFramer, PacketType } from "./types";

export type MqttPacketParser = (
  fixedHeader: FixedHeader,
  restOfPacket?: Uint8Array
) => AnyPacket;

// MqttPacketDecoder is responsible for decoding MQTT control packets from a stream of bytes.
export class MqttPacketDecoder {
  /**
   * Creates an instance of MqttPacketDecoder with the provided MQTT packet framer and parsing function.
   * @param framer - The MQTT packet framer used to frame incoming bytes into complete MQTT packets.
   * @param parseFunction - The function used to parse framed MQTT packets into packet objects.
   */
  public constructor(
    private readonly framer: IMqttPacketFramer,
    private readonly parseFunction: MqttPacketParser
  ) {}

  /**
   * Decodes MQTT packets from the given chunk of bytes, emitting events for packet readiness and framing.
   * @param chunk - A Uint8Array containing the bytes to decode.
   * @returns An array of decoded MQTT packets or null if no packets were decoded.
   */
  public write(chunk: Uint8Array) {
    if (chunk.length === 0) return;

    this.framer.write(chunk);

    while (this.framer.hasPacket) {
      // read the next complete raw packet from the framer
      const [fixedHeader, restOfPacket] = this.framer.readPacket();
      const packet = this.parseFunction(fixedHeader, restOfPacket);

      this.onPacketReady(packet);
    }
  }

  // event called when a packet has been framed (fixed header parsed)
  public onPacketReady: (packet: AnyPacket) => void = () => {
    throw new Error("onPacketReady callback is not set.");
  };
}
