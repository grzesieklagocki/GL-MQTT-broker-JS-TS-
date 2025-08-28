import { FixedHeader } from "../../../shared/types";
import { PublishPacketV4 } from "../../types";
import { MQTTReaderV4 } from "../MQTTReaderV4";

export function parsePublishPacketV4(
  fixedHeader: FixedHeader,
  reader: MQTTReaderV4
): PublishPacketV4 {
  throw new Error("Function not implemented.");
}
