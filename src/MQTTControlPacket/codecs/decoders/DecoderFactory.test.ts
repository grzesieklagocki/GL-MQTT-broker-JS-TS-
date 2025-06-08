import { describe, expect, it } from "vitest";
import { DecoderFactory, DecoderType } from "./DecoderFactory";
import { BytesDecoder } from "./BytesDecoder";

describe("Test DecoderFactory.Create(type)", () => {
  it("returns instance of BytesDecoder with remainingBytes = 2 when type=`TwoByteInteger`", () => {
    const decoder = DecoderFactory.Create(DecoderType.TwoByteInteger);
    expect((decoder as BytesDecoder).remainingBytes).toBe(2);
    expect(decoder.takeNextByte(0xab)).toBe(false);
    expect(decoder.takeNextByte(0xbc)).toBe(0xabbc);
  });
  it("returns instance of BytesDecoder with remainingBytes = 4 when type=`FourByteInteger`", () => {
    const decoder = DecoderFactory.Create(DecoderType.FourByteInteger);
    expect((decoder as BytesDecoder).remainingBytes).toBe(4);
    expect(decoder.takeNextByte(0xab)).toBe(false);
    expect(decoder.takeNextByte(0xbc)).toBe(false);
    expect(decoder.takeNextByte(0xcd)).toBe(false);
    expect(decoder.takeNextByte(0xde)).toBe(0xabbccdde);
  });
  it("returns instance of VariableByteIntegerDecoder when type=`VariableByteInteger`", () => {
    const decoder = DecoderFactory.Create(DecoderType.VariableByteInteger);
    expect(decoder.takeNextByte(0x80)).toBe(false);
    expect(decoder.takeNextByte(0x01)).toBe(0x80);
  });
});
