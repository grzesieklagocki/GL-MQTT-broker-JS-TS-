export function createDescription(input: number[], expected: number): string {
  return `decodes ${input.length} byte(s): [${input
    .map((x) => toHex(x, 2))
    .join(", ")}] => ${toHex(expected, 2 * input.length)}`;
}

function toHex(value: number, pad: number): string {
  return "0x" + value.toString(16).padStart(pad, "0");
}
