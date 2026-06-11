import { FixedHeader } from "../../shared/types";
import { AnyPacketV4 } from "../types";
import { MQTTReaderV4 } from "./MQTTReaderV4";
import { FixedHeaderParserV4 } from "./parsers/FixedHeaderParserV4";
import { parsePacketV4 } from "./parsers/parsePacketV4";

export class ControlPacketDecoderV4 {
  // buffer to store data between calls
  private buffer: BinaryBuffer;

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
    this.buffer = new BinaryBuffer();
    this.isFixedHeaderDecoded = false;
  }

  /**
   * Decodes multiple MQTT packets from the given chunks.
   * @param chunk - A Uint8Array containing the bytes to decode.
   * @returns An array of decoded MQTT packets or null if no packets were decoded.
   */
  public decode(chunk: Uint8Array): AnyPacketV4[] {
    if (chunk.length === 0) return [];

    this.buffer.write(chunk); // append new data to the buffer
    const reader = this.getReader(); // create a reader from the buffer data

    const packets: AnyPacketV4[] = []; // for decoded packets

    while (reader.remaining > 0) {
      if (!this.isFixedHeaderDecoded) {
        this.parseFixedHeader(reader);
      } else {
        this.parseRest(reader);
      }

      if (this.isPacketReady) {
        const packet = this.parsePacket();
        packets.push(packet);

        this.resetState();
      }
    }

    return packets;
  }

  // creates a MQTTReaderV4 from buffer
  private getReader(): MQTTReaderV4 {
    const array = this.buffer.read();
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
      // if Fixed Header is parsed
      // store it and mark as decoded
      this.fixedHeader = fixedHeader;
      this.isFixedHeaderDecoded = true;
    }
  }

  // parse rest of the packet and append bytes to the buffer
  private parseRest(reader: MQTTReaderV4): void {
    // number of bytes to read to complete the packet
    const count = Math.min(this.remainingBytesCount, reader.remaining);

    if (count > 0) {
      const bytes = reader.readBytes(count);
      this.buffer.write(bytes);
    }
  }

  // parse the complete Control Packet
  private parsePacket(): AnyPacketV4 {
    const reader = new MQTTReaderV4(this.buffer.read());
    const packet = parsePacketV4(this.fixedHeader, reader);

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
    // (bytes left) = (total bytes needed) - (bytes already received)
    return this.fixedHeader.remainingLength - this.buffer.remaining;
  }

  //
  // State reset methods
  //

  // resets the internal state after a packet is fully decoded
  private resetState(): void {
    this.isFixedHeaderDecoded = false;
  }
}

class BinaryBuffer {
  private array: Uint8Array = new Uint8Array();

  constructor() {}

  // returns the number of bytes in the buffer
  public get remaining() {
    return this.array.length;
  }

  // returns the data in the buffer
  public read(): Uint8Array {
    const array = this.array;

    this.reset();

    return array;
  }

  // appends new bytes to the buffer
  public write(bytes: Uint8Array): void {
    this.array = new Uint8Array([...this.array, ...bytes]);
  }

  // resets the buffer to an empty state
  private reset(): void {
    this.array = new Uint8Array();
  }
}
