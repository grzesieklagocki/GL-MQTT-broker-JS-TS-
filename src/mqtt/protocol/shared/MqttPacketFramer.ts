import { AppError } from "@src/AppError";
import {
  FixedHeader,
  IBinaryBuffer,
  IFixedHeaderParser,
  IMqttPacketFramer,
} from "./types";
import { BinaryBuffer } from "./BinaryBuffer";

// Class responsible for framing MQTT packets from a stream of bytes,
// handling the parsing of fixed headers and buffering of incoming data.
export class MqttPacketFramer implements IMqttPacketFramer {
  // fixed header of the current packet
  private fixedHeader: FixedHeader;

  // flag to indicate if the fixed header has been parsed
  private isFixedHeaderParsed: boolean;

  // Indicates whether there is a complete packet available in the buffer
  public get hasPacket(): boolean {
    this.tryParseFixedHeader(); // attempt to parse the fixed header if it hasn't been parsed yet

    return (
      this.isFixedHeaderParsed &&
      this.buffer.remaining >= this.fixedHeader.remainingLength // ensure the entire packet is available
    );
  }

  /**
   * Creates an instance of MqttPacketFramer with the provided binary buffer.
   * @param fixedHeaderParser The parser used to parse the fixed header of MQTT packets.
   * @param buffer (optional) The binary buffer used for reading and writing MQTT packet data. If not provided, a new BinaryBuffer instance will be used.
   */
  public constructor(
    private readonly fixedHeaderParser: IFixedHeaderParser,
    private readonly buffer: IBinaryBuffer = new BinaryBuffer()
  ) {
    // Initialize internal state
    this.fixedHeader = {} as any;
    this.isFixedHeaderParsed = false;
  }

  /**
   * Writes the given bytes to the internal buffer and attempts to parse the fixed header if it hasn't been parsed yet.
   * @param bytes The bytes to write to the buffer.
   */
  public write = (bytes: Uint8Array) => {
    this.buffer.write(bytes);
  };

  /**
   * Reads a complete MQTT packet from the buffer, returning its fixed header and the rest of the packet.
   * @returns A tuple containing the fixed header and the remaining bytes of the packet.
   */
  public readPacket(): [fixedHeader: FixedHeader, restOfPacket?: Uint8Array] {
    if (!this.hasPacket)
      throw new AppError("No complete packet available to read.");

    this.isFixedHeaderParsed = false;

    const packetRemainingLength = this.fixedHeader.remainingLength;

    const restOfPacket =
      packetRemainingLength > 0
        ? this.buffer.read(packetRemainingLength)
        : undefined;

    return [this.fixedHeader, restOfPacket];
  }

  // Try to parse the fixed header if it hasn't been parsed yet
  private tryParseFixedHeader() {
    if (this.isFixedHeaderParsed) return;

    const fixedHeader = this.fixedHeaderParser.parse(this.buffer);

    if (fixedHeader) {
      this.isFixedHeaderParsed = true;
      this.fixedHeader = fixedHeader;
    }
  }
}
