import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { IMqttPacketCodec } from "../client/shared/types";
import { PacketType } from "@mqtt/protocol/shared/types";
import { MqttPacketDecoder } from "@mqtt/protocol/shared/MqttPacketDecoder";
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
   * Callback function to be invoked when a packet is framed and ready to be decoded.
   * @param packetType - The type of the MQTT packet that was framed.
   * @param decode - A function that, when called, will decode the framed packet into an MQTT packet of type AnyPacketV4.
   * @returns true if the packet was successfully handled, or an Error if there was an issue.
   */
  public packetReadyHandler: (
    packetType: PacketType,
    decode: () => AnyPacketV4
  ) => void = () => new Error("packetReadyHandler callback is not set.");

  private createDecoder() {
    const decoder = new MqttPacketDecoder(
      new MqttPacketFramer(new FixedHeaderParserV4(), new BinaryBuffer()),
      (fixedHeader, restOfPacket) =>
        parseMqttPacketV4(
          fixedHeader,
          restOfPacket ? new MQTTReaderV4(restOfPacket) : undefined
        )
    );

    decoder.onPacketReady = (packetType, decode) =>
      this.packetReadyHandler(packetType, decode);

    return decoder;
  }
}
