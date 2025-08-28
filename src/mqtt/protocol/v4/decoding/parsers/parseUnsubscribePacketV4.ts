import { FixedHeader } from "../../../shared/types";
import { UnsubscribePacketV4 } from "../../types";
import { MQTTReaderV4 } from "../MQTTReaderV4";

export function parseUnsubscribePacketV4(
  fixedHeader: FixedHeader,
  reader: MQTTReaderV4
): UnsubscribePacketV4 {
  throw new Error("Function not implemented.");
}
