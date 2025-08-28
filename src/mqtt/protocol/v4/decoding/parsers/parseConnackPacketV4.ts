import { FixedHeader } from "../../../shared/types";
import { ConnackPacketV4 } from "../../types";
import { MQTTReaderV4 } from "../MQTTReaderV4";

export function parseConnackPacketV4(
  fixedHeader: FixedHeader,
  reader: MQTTReaderV4
): ConnackPacketV4 {
  throw new Error("Function not implemented.");
}
