import { MQTTReaderBase } from "../../shared/MQTTReaderBase";
import { IMQTTReaderV4 } from "../types";

/**
 * Utility class for reading MQTT 3.1.1 packet data from a byte array.
 * Extends DataReader to support MQTT 3.1.1 types.
 */
export class MQTTReaderV4 extends MQTTReaderBase implements IMQTTReaderV4 {
  /**
   * Creates an instance of the class using the provided byte array.
   * @param array The Uint8Array containing the data to be read.
   */
  public constructor(array: Uint8Array) {
    super(array);
  }
}
