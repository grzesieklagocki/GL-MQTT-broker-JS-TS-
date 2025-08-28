import { FixedHeader } from "../../../shared/types";
import {
  PubackPacketV4,
  PubrecPacketV4,
  PubrelPacketV4,
  PubcompPacketV4,
  UnsubackPacketV4,
} from "../../types";
import { MQTTReaderV4 } from "../MQTTReaderV4";

type PacketWithIdentifier =
  | PubackPacketV4
  | PubrecPacketV4
  | PubrelPacketV4
  | PubcompPacketV4
  | UnsubackPacketV4;

export function parsePacketWithIdentifierV4(
  fixedHeader: FixedHeader,
  reader: MQTTReaderV4
): PacketWithIdentifier {
  throw new Error("Function not implemented.");
}
