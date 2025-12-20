import { FixedHeader } from "../../shared/types";
import { AnyPacketV4 } from "../types";
import { MQTTReaderV4 } from "./MQTTReaderV4";
import { FixedHeaderParserV4 } from "./parsers/FixedHeaderParserV4";
import { parseControlPacketV4 } from "./parsers/parseControlPacketV4";

export class ControlPacketDecoderV4 {
  // buffer to store remaining data for the current packet
  private remainingDataBuffer: Uint8Array;

  // fixed header of the current packet
  private fixedHeader: FixedHeader;

  // parser for the fixed header
  private fixedHeaderParser: FixedHeaderParserV4;

  // flag to indicate if the fixed header has been decoded
  private isFixedHeaderDecoded: boolean;

  /**
   * Creates an instance of ControlPacketDecoderV4.
   */
  public constructor() {
    // Initialize internal state
    this.fixedHeader = {} as any;
    this.fixedHeaderParser = new FixedHeaderParserV4();
    this.remainingDataBuffer = new Uint8Array();
    this.isFixedHeaderDecoded = false;
  }

  /**
   * Decodes multiple MQTT packets from the given chunks.
   * @param chunks - An array of Uint8Array chunks representing MQTT packets.
   * @returns An array of decoded MQTT packets or null if no packets were decoded.
   */
  public decode(chunk: Uint8Array): AnyPacketV4[] {
    const reader = this.getReader(chunk); // append new data chunk to existing buffer
    this.resetBuffer(); // data from buffer is already in the reader, can clear bu

    const packets: AnyPacketV4[] = []; // for decoded packets

    while (reader.remaining > 0) {
      if (!this.isFixedHeaderDecoded) {
        this.parseFixedHeader(reader);
      } else {
        this.parseRemainingLength(reader);
      }

      if (this.isPacketReady) {
        const packet = this.parsePacket();
        packets.push(packet);

        this.resetState();
      }
    }

    return packets;
  }

  // creates a MQTTReaderV4 with the current buffer and the new chunk
  private getReader(chunk: Uint8Array): MQTTReaderV4 {
    const array = new Uint8Array([...this.remainingDataBuffer, ...chunk]);
    const reader = new MQTTReaderV4(array);

    return reader;
  }

  //
  // Parsing methods
  //

  // parse Fixed Header from the reader
  private parseFixedHeader(reader: MQTTReaderV4): void {
    const fixedHeader = this.fixedHeaderParser.parse(reader);

    if (fixedHeader) {
      // if Fixed Header is fully parsed
      // store it and mark as decoded
      this.fixedHeader = fixedHeader;
      this.isFixedHeaderDecoded = true;
    }
  }

  // parse Remaining Length and append bytes to the buffer
  private parseRemainingLength(reader: MQTTReaderV4): void {
    // number of bytes to read to complete the packet
    const count = Math.min(this.remainingBytesCount, reader.remaining);

    if (count > 0) {
      const bytes = reader.readBytes(count);
      this.appendToBuffer(bytes);
    }
  }

  // parse the complete Control Packet
  private parsePacket(): AnyPacketV4 {
    const reader = new MQTTReaderV4(this.remainingDataBuffer);
    const packet = parseControlPacketV4(this.fixedHeader, reader);

    return packet;
  }

  //
  // State check methods
  //

  // checks if the entire packet has been received
  private get isPacketReady(): boolean {
    return this.isFixedHeaderDecoded && this.remainingBytesCount === 0;
  }

  // gets the number of bytes left to complete the packet
  private get remainingBytesCount(): number {
    if (this.fixedHeader)
      return (
        // (bytes left) = (total bytes needed) - (bytes already received)
        this.fixedHeader?.remainingLength - this.remainingDataBuffer.length
      );

    throw Error("Fixed header is not decoded yet");
  }

  // appends bytes to the internal buffer
  private appendToBuffer(bytes: Uint8Array): void {
    this.remainingDataBuffer = new Uint8Array([
      ...this.remainingDataBuffer,
      ...bytes,
    ]);
  }

  //
  // State reset methods
  //

  // resets the internal state after a packet is fully decoded
  private resetState(): void {
    this.resetFixedHeader();
    this.resetBuffer();
  }

  // resets the fixed header state
  private resetFixedHeader(): void {
    this.isFixedHeaderDecoded = false;
  }

  // resets the internal data buffer
  private resetBuffer(): void {
    this.remainingDataBuffer = new Uint8Array();
  }
}
