export const arrayToHexString = (array: number[]) =>
  `[${array.map((b) => "0x" + b.toString(16).padStart(2, "0")).join(", ")}]`;

export const uint8ToHexString = (value: number, pad: number) =>
  `0x${value.toString(16).padStart(pad, "0")}`;
