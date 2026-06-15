import { AnyPacket, FixedHeader, IMqttPacketFramer } from "./types";

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
  ) {
    // Initialize empty event handlers for packet framing and parsing
    this.onPacketFramed = () => {};
    this.onPacketParsed = () => {};
  }

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

      // call event for packet framed (fixed header parsed)
      this.onPacketFramed(fixedHeader);

      // parse packet using the provided parse function
      const packet = this.parseFunction(fixedHeader, restOfPacket);

      // call event for packet parsed
      this.onPacketParsed(packet);
    }
  }

  // event called when a packet has been framed (fixed header parsed)
  public onPacketFramed: (fixedHeader: FixedHeader) => void;

  // event called when a packet has been parsed
  public onPacketParsed: (packet: AnyPacket) => void;
}
