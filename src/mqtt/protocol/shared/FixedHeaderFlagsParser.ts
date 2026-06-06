import { FixedHeaderFlags } from "./types";

/**
 * Parses the flags byte from a MQTT Fixed Header and extracts the Retain, QoS, and Dup values.
 * @param flags The flags byte from the MQTT Fixed Header (must be a value between 0 and 8).
 * @returns An object containing the Retain, QoS, and Dup values extracted from the flags byte.
 */
export function parseFixedHeaderFlags(flags: number): FixedHeaderFlags {
  if (flags < 0 || flags > 0x0f)
    throw new Error("Invalid flags value, must be one byte (0-16)");

  const retain = flags & 0b0001;
  const qos = (flags & 0b0110) >> 1;
  const dup = (flags & 0b1000) >> 3;

  return { retain: retain === 1, qos: qos, dup: dup === 1 };
}
