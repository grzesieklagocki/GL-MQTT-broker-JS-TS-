import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { IMqttPacketCodec } from "./types";
import {
  MqttPacketDecoder,
  MqttPacketParser,
} from "@mqtt/protocol/shared/MqttPacketDecoder";
import { MqttPacketFramer } from "@mqtt/protocol/shared/MqttPacketFramer";
import { FixedHeaderParserV4 } from "@mqtt/protocol/v4/decoding/parsers/FixedHeaderParserV4";
import { BinaryBuffer } from "@mqtt/protocol/shared/BinaryBuffer";
import { parseMqttPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseMqttPacketV4";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { encodeMqttPacketV4 } from "@mqtt/protocol/v4/encoding/encodeMqttPacketV4";

/**
 * MqttPacketCodecV4 is responsible for encoding and decoding MQTT packets for version 4 of the protocol.
 */
export class MqttPacketCodecV4 implements IMqttPacketCodec<AnyPacketV4> {
  private decoder: MqttPacketDecoder = this.createDecoder();

  public constructor(
    private readonly flow?: "both" | "clientToBroker" | "brokerToClient"
  ) {}

  /**
   * Resets the internal state of the codec, including the decoder, to prepare for new packet processing.
   */
  public resetState(): void {
    this.decoder = this.createDecoder();
  }

  /**
   * Encodes an MQTT packet into a Uint8Array of bytes for transmission.
   * @param packet - The MQTT packet to be encoded.
   * @returns A Uint8Array containing the encoded bytes of the MQTT packet.
   */
  public encode = (packet: AnyPacketV4): Uint8Array =>
    encodeMqttPacketV4(packet);

  /**
   * Feeds a buffer of bytes to the codec for processing. The codec will handle framing and decoding of the bytes into MQTT packets.
   * @param bytes - The buffer of bytes to be fed to the codec.
   */
  public feed(bytes: Uint8Array): void {
    this.decoder.write(bytes);
  }

  /**
   * Callback function to be invoked when a packet is fully decoded.
   * @param packet - The decoded MQTT packet.
   */
  public packetDecodedHandler: (packet: AnyPacketV4) => void = () => {
    throw new Error("packetDecodedHandler callback is not set.");
  };

  private createDecoder() {
    const framer = new MqttPacketFramer(
      new FixedHeaderParserV4(this.flow),
      new BinaryBuffer()
    );

    const parseFunction: MqttPacketParser = (fixedHeader, restOfPacket) =>
      parseMqttPacketV4(
        fixedHeader,
        restOfPacket ? new MQTTReaderV4(restOfPacket) : undefined
      );

    const decoder = new MqttPacketDecoder(framer, parseFunction);

    // Forward packets through a wrapper so the current packetDecodedHandler
    // is always used, even when the handler is reassigned after construction
    // or after resetState() creates a new decoder.
    decoder.onPacketReady = (packet) => this.packetDecodedHandler(packet);

    return decoder;
  }
}
