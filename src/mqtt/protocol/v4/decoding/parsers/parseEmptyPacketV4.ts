// SIMPLE PACKET

import { FixedHeader } from "../../../shared/types";
import {
  PingreqPacketV4,
  PingrespPacketV4,
  DisconnectPacketV4,
} from "../../types";
import { MQTTReaderV4 } from "../MQTTReaderV4";

type EmptyPacket = PingreqPacketV4 | PingrespPacketV4 | DisconnectPacketV4;

export function parseEmptyPacketV4(
  fixedHeader: FixedHeader,
  reader: MQTTReaderV4
): EmptyPacket {
  throw new Error("Function not implemented.");
}
