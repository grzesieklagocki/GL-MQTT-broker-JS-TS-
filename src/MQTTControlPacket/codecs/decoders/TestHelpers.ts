/**
 * Helper function to create description of decoder's test
 * @param input Input value
 * @param expected Expected value
 * @returns Description as `string`,
 * e.g. `decodes 0x61 to "a"`
 */
export function createDecodesDescription(
  input: number[],
  expected: number
): string {
  return `decodes ${input.length} byte(s): [${input
    .map((x) => toHex(x, 2))
    .join(", ")}] => ${toHex(expected, 2 * input.length)}`;
}

/**
 * Creates a hexadecimal representation of `number` as `string`
 * @param value Value to convert
 * @param pad The length of the resulting string once the current string has been padded (with "0")
 * @returns
 */
function toHex(value: number, pad: number): string {
  return "0x" + value.toString(16).padStart(pad, "0");
}

/**
 * Creates an array of `number`s from hexadecimal value
 * @param hex Hexadecimal representation of value as `string`
 * @returns Bytes as array of `number`s
 */
function ArrayFromHex(hex: string): number[] {
  const bytes = hex.match(/.{1,2}/g)!;

  return bytes.map((byte) => parseInt(byte, 16));
}

/**
 * Creates an `Uint8Array` from hexadecimal value
 * @param hex Hexadecimal representation of value as `string`
 * @returns Bytes as `Uint8Array`
 */
export function Uint8ArrayFromHex(hex: string): Uint8Array {
  const array = ArrayFromHex(hex);

  return Uint8Array.from(array);
}
