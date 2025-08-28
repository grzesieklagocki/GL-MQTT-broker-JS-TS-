import { FixedHeader } from "../../../shared/types";
import { ConnectPacketV4 } from "../../types";
import { MQTTReaderV4 } from "../MQTTReaderV4";

export function parseConnectPacketV4(
  fixedHeader: FixedHeader,
  reader: MQTTReaderV4
): ConnectPacketV4 {
  throw new Error("Function not implemented.");
}
