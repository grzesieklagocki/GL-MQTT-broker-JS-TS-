import { describe, expect, it } from "vitest";
import { generateRandomClientId } from "@mqtt/shared/generateRandomClientId";

describe("generateRandomClientId", () => {
  const REGEX = /^[a-zA-Z0-9]+$/;

  it("generates a valid MQTT client identifier according to [MQTT-3.1.3-5]", () => {
    const clientId = generateRandomClientId();

    expect(clientId).toMatch(REGEX);
    expect(clientId.length).toBeGreaterThanOrEqual(1);
    expect(clientId.length).toBeLessThanOrEqual(23);
  });

  it("generates valid MQTT client identifiers multiple times", () => {
    for (let i = 0; i < 1_000; i++) {
      const clientId = generateRandomClientId();

      expect(clientId).toMatch(REGEX);
      expect(clientId.length).toBeGreaterThanOrEqual(1);
      expect(clientId.length).toBeLessThanOrEqual(23);
    }
  });

  it("generates random MQTT client identifiers", () => {
    const id1 = generateRandomClientId();
    const id2 = generateRandomClientId();
    const id3 = generateRandomClientId();

    expect(id1).not.toEqual(id2);
    expect(id2).not.toEqual(id3);
  });
});
