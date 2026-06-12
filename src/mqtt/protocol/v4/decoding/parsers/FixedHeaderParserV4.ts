import { FixedHeaderParserBase } from "@src/mqtt/protocol/shared/FixedHeaderParserBase";
import { FixedHeaderValidatorV4 } from "./FixedHeaderValidatorV4";

export class FixedHeaderParserV4 extends FixedHeaderParserBase {
  constructor() {
    super(new FixedHeaderValidatorV4());
  }
}
