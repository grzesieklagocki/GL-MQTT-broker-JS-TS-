import { AppError } from "@src/AppError";

/**
 * Converts a `Uint8Array` to a JavaScript `string` and validates it
 * Rules come from UTF‑8 (RFC 3629) and MQTT 5.0 (sections 1.5.4 and 5.4.9).
 *
 * Must reject strings that contain:
 * - U+0000 (NULL),
 * - UTF‑16 surrogates: U+D800..U+DFFF,
 * - control characters: U+0001..U+001F and U+007F..U+009F,
 * - Unicode non‑characters
 *
 * Note: U+FEFF (BOM) is allowed and preserved.
 *
 * UTF-8 (RFC 3629): https://datatracker.ietf.org/doc/html/rfc3629
 * MQTT Version 5.0: https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html
 *
 * @param array UTF‑8 encoded bytes as `Uint8Array`.
 * @returns Decoded `string`.
 * @throws Error `"Malformed UTF-8 string"` if bytes are not valid UTF‑8 or
 *         decoded text violates the MQTT Unicode restrictions above.
 */
export function Uint8ArrayToUtf8String(array: Uint8Array): string {
  let text: string;
  const decoder = new TextDecoder("utf-8", { fatal: true });

  // The character data in a UTF-8 encoded string MUST be well-formed UTF-8
  // as defined by the Unicode specification [Unicode] and restated in RFC 3629 [RFC3629].
  // In particular this data MUST NOT include encodings of code points between U+D800 and U+DFFF.
  // If a Server or Client receives a Control Packet containing ill-formed UTF-8 it MUST close the Network Connection
  // [MQTT-1.5.3-1]
  try {
    text = decoder.decode(array);
  } catch (error) {
    throw _assertIsInvalidUtf8(error as Error);
  }

  _assertIsInvalidMqttUtf8(text);

  // A UTF-8 encoded sequence 0xEF 0xBB 0xBF is always to be interpreted to mean U+FEFF ("ZERO WIDTH NO-BREAK SPACE")
  // wherever it appears in a string and MUST NOT be skipped over or stripped off by a packet receiver
  // [MQTT-1.5.3-3]
  return hasBOM(array) ? restoreBOM(text) : text;
}

function isValidMqttUtf8(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const codePoint = str.codePointAt(i)!;

    if (!isValidMqttUtf8CodePoint(codePoint)) return false;

    if (codePoint > 0xffff) i++; // skip next char
  }

  return true;
}

const _assertIsInvalidUtf8 = (error: Error): AppError => {
  throw new AppError("Invalid UTF-8 byte sequence", error);
};

const _assertIsInvalidMqttUtf8 = (text: string) => {
  if (!isValidMqttUtf8(text))
    throw new AppError(
      `"${text}" is valid UTF-8 string, but does not meet MQTT spec requirements`
    );
};

const isValidMqttUtf8CodePoint = (codePoint: number) =>
  !isNullCharacter(codePoint) &&
  !isUnicodeControlCharacter(codePoint) &&
  !isUnicodeNonCharacter(codePoint);

const isNullCharacter = (codePoint: number) => codePoint === 0x0000;

const isUnicodeControlCharacter = (codePoint: number) =>
  (codePoint >= 0x0001 && codePoint <= 0x001f) ||
  (codePoint >= 0x007f && codePoint <= 0x009f);

const isUnicodeNonCharacter = (codePoint: number) =>
  (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
  //
  // 0x00fffe, 0x00ffff, 0x01fffe, 0x01ffff, 0x02fffe, 0x02ffff, 0x03fffe, 0x03ffff,
  // 0x04fffe, 0x04ffff, 0x05fffe, 0x05ffff, 0x06fffe, 0x06ffff, 0x07fffe, 0x07ffff,
  // 0x08fffe, 0x08ffff, 0x09fffe, 0x09ffff, 0x0afffe, 0x0affff, 0x0bfffe, 0x0bffff,
  // 0x0cfffe, 0x0cffff, 0x0dfffe, 0x0dffff, 0x0efffe, 0x0effff, 0x0ffffe, 0x0fffff,
  // 0x10fffe, 0x10ffff,
  ((codePoint & 0xfffe) === 0xfffe &&
    codePoint >= 0x00fffe &&
    codePoint <= 0x10ffff);

const hasBOM = (array: Uint8Array) =>
  array.length >= 3 &&
  array[0] === 0xef &&
  array[1] === 0xbb &&
  array[2] === 0xbf;

const restoreBOM = (str: string) => {
  const bom = "\uFEFF";

  return bom + str;
};
