import { FixedHeader } from "../../../shared/types";
import { SubackPacketV4 } from "../../types";
import { MQTTReaderV4 } from "../MQTTReaderV4";

export function parseSubackPacketV4(
  fixedHeader: FixedHeader,
  reader: MQTTReaderV4
): SubackPacketV4 {
  throw new Error("Function not implemented.");
}
