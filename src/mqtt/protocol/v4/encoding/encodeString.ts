/**
 * Encodes a string into a Uint8Array using UTF-8 encoding.
 * @param str - The string to encode.
 * @returns A Uint8Array representing the encoded string.
 */
export const encodeStringUtf8 = (str: string) => encoder.encode(str);

const encoder = new TextEncoder();
