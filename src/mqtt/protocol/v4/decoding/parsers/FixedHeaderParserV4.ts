import { FixedHeaderParserBase } from "@src/mqtt/protocol/shared/FixedHeaderParserBase";
import { FixedHeaderValidatorV4 } from "./FixedHeaderValidatorV4";
import { IMQTTReaderV4 } from "../../types";

export class FixedHeaderParserV4 extends FixedHeaderParserBase<IMQTTReaderV4> {
  constructor() {
    super(new FixedHeaderValidatorV4());
  }
}
