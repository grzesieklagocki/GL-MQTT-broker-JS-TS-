import { FixedHeader } from "../../../shared/types";
import { SubscribePacketV4 } from "../../types";
import { MQTTReaderV4 } from "../MQTTReaderV4";

export function parseSubscribePacketV4(
  fixedHeader: FixedHeader,
  reader: MQTTReaderV4
): SubscribePacketV4 {
  throw new Error("Function not implemented.");
}
