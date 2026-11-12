import { beforeEach, describe, expect, it } from "vitest";
import { RetainedMessagesManager } from "@mqtt/broker/topics/RetainedMessagesManager";
import { QoS } from "@mqtt/protocol/shared/types";

type RetainedMessage = {
  topic: string;
  payload: Uint8Array;
  qos: QoS;
};

describe("RetainedMessagesManager", () => {
  let manager: RetainedMessagesManager;

  const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

  const expectMessages = (topicFilter: string, expected: RetainedMessage[]) => {
    const actual = manager.get(topicFilter);

    expect(actual).toHaveLength(expected.length);
    expect(actual).toEqual(expect.arrayContaining(expected));
  };

  beforeEach(() => {
    manager = new RetainedMessagesManager();
  });

  describe("set", () => {
    it.each([0, 1, 2] as QoS[])(
      "should store a retained message with QoS %i",
      (qos) => {
        manager.set("home/light", encode("ON"), qos);

        expectMessages("home/light", [
          { topic: "home/light", payload: encode("ON"), qos },
        ]);
      }
    );

    it("should store multiple retained messages", () => {
      manager.set("home/light", encode("ON"), 0);
      manager.set("home/temp", encode("22"), 1);
      manager.set("garden/temp", encode("18"), 2);

      expectMessages("#", [
        { topic: "home/light", payload: encode("ON"), qos: 0 },
        { topic: "home/temp", payload: encode("22"), qos: 1 },
        { topic: "garden/temp", payload: encode("18"), qos: 2 },
      ]);
    });

    it("should replace an existing retained message and its QoS", () => {
      manager.set("home/light", encode("ON"), 2);
      manager.set("home/light", encode("OFF"), 0);

      expectMessages("home/light", [
        { topic: "home/light", payload: encode("OFF"), qos: 0 },
      ]);
    });

    it("should not duplicate retained messages when overwriting", () => {
      manager.set("home/light", encode("ON"), 1);
      manager.set("home/light", encode("OFF"), 2);

      expectMessages("home/light", [
        { topic: "home/light", payload: encode("OFF"), qos: 2 },
      ]);
    });

    it.each([0, 1, 2] as QoS[])(
      "should remove a retained message when payload is empty (QoS %i)",
      (qos) => {
        manager.set("home/light", encode("ON"), 1);
        manager.set("home/light", new Uint8Array(), qos);

        expectMessages("home/light", []);
      }
    );

    it("should not affect other topics when replacing a message", () => {
      manager.set("home/light", encode("ON"), 1);
      manager.set("home/temp", encode("22"), 2);

      manager.set("home/light", encode("OFF"), 0);

      expectMessages("#", [
        { topic: "home/light", payload: encode("OFF"), qos: 0 },
        { topic: "home/temp", payload: encode("22"), qos: 2 },
      ]);
    });

    it("should support binary payloads", () => {
      const payload = new Uint8Array([0x00, 0xff, 0x80, 0x01]);

      manager.set("binary/data", payload, 2);

      expectMessages("binary/data", [
        { topic: "binary/data", payload, qos: 2 },
      ]);
    });

    it("should preserve empty topic levels", () => {
      manager.set("home//light", encode("ON"), 1);

      expectMessages("home//light", [
        { topic: "home//light", payload: encode("ON"), qos: 1 },
      ]);
      expectMessages("home/light", []);
    });
  });

  describe("get", () => {
    it("should return an empty array when no messages are stored", () => {
      expectMessages("#", []);
    });

    it("should return an empty array when no messages match", () => {
      manager.set("home/light", encode("ON"), 1);

      expectMessages("garden/#", []);
    });

    it.each([
      // Exact matches
      ["home/light", "home/light", true],
      ["home/light", "home/temp", false],
      ["home/light", "home", false],

      // Single-level wildcard (+)
      ["home/light", "home/+", true],
      ["home/light/state", "home/+", false],
      ["home/light/state", "+/light/+", true],
      ["home/light", "+/+", true],
      ["home/light", "+/+/+", false],

      // Multi-level wildcard (#)
      ["home/light", "#", true],
      ["home/light", "home/#", true],
      ["home/light/state", "home/#", true],
      ["home", "home/#", true],
      ["home/light", "light/#", false],
      ["home/light/state", "+/light/#", true],

      // Empty topic levels
      ["home/", "home/+", true],
      ["home/", "home/#", true],
      ["/home", "+/home", true],
      ["home//light", "home/+/light", true],

      // Reserved $ topics
      ["$SYS/broker", "#", false],
      ["$SYS/broker", "+/broker", false],
      ["$SYS/broker", "$SYS/#", true],
      ["$SYS/broker", "$SYS/+", true],
      ["$SYS/broker", "$SYS/broker", true],
      ["home/$SYS", "#", true],
    ] as [string, string, boolean][])(
      "should match topic '%s' against filter '%s': %s",
      (topic, topicFilter, match) => {
        const payload = encode("test");

        manager.set(topic, payload, 1);

        expectMessages(topicFilter, match ? [{ topic, payload, qos: 1 }] : []);
      }
    );

    it("should return all messages matching a wildcard filter", () => {
      manager.set("home/light", encode("ON"), 0);
      manager.set("home/temp", encode("22"), 1);
      manager.set("home/kitchen/temp", encode("23"), 2);
      manager.set("garden/temp", encode("18"), 1);

      expectMessages("home/#", [
        { topic: "home/light", payload: encode("ON"), qos: 0 },
        { topic: "home/temp", payload: encode("22"), qos: 1 },
        { topic: "home/kitchen/temp", payload: encode("23"), qos: 2 },
      ]);
    });

    it("should distinguish single-level and multi-level wildcards", () => {
      manager.set("home", encode("root"), 0);
      manager.set("home/light", encode("ON"), 1);
      manager.set("home/kitchen/light", encode("OFF"), 2);

      expectMessages("home/+", [
        { topic: "home/light", payload: encode("ON"), qos: 1 },
      ]);

      expectMessages("home/#", [
        { topic: "home", payload: encode("root"), qos: 0 },
        { topic: "home/light", payload: encode("ON"), qos: 1 },
        { topic: "home/kitchen/light", payload: encode("OFF"), qos: 2 },
      ]);
    });

    it("should exclude $ topics from root wildcard filters", () => {
      manager.set("$SYS/broker", encode("online"), 1);
      manager.set("$custom/value", encode("custom"), 2);
      manager.set("home/light", encode("ON"), 0);

      expectMessages("#", [
        { topic: "home/light", payload: encode("ON"), qos: 0 },
      ]);

      expectMessages("$SYS/#", [
        { topic: "$SYS/broker", payload: encode("online"), qos: 1 },
      ]);
    });

    it("should preserve case sensitivity", () => {
      manager.set("Home/Light", encode("ON"), 1);

      expectMessages("Home/Light", [
        { topic: "Home/Light", payload: encode("ON"), qos: 1 },
      ]);
      expectMessages("home/light", []);
    });

    it("should treat whitespace as significant", () => {
      manager.set("home /light", encode("ON"), 1);

      expectMessages("home /light", [
        { topic: "home /light", payload: encode("ON"), qos: 1 },
      ]);
      expectMessages("home/light", []);
    });

    it("should preserve QoS independently for each retained message", () => {
      manager.set("home/light", encode("ON"), 0);
      manager.set("home/temp", encode("22"), 2);

      expectMessages("home/#", [
        { topic: "home/light", payload: encode("ON"), qos: 0 },
        { topic: "home/temp", payload: encode("22"), qos: 2 },
      ]);
    });
  });

  describe("remove", () => {
    it("should remove an existing retained message", () => {
      manager.set("home/light", encode("ON"), 1);

      manager.remove("home/light");

      expectMessages("home/light", []);
    });

    it("should not affect other retained messages", () => {
      manager.set("home/light", encode("ON"), 1);
      manager.set("home/temp", encode("22"), 2);

      manager.remove("home/light");

      expectMessages("#", [
        { topic: "home/temp", payload: encode("22"), qos: 2 },
      ]);
    });

    it("should not throw when removing a nonexistent topic", () => {
      expect(() => manager.remove("unknown/topic")).not.toThrow();
    });

    it("should allow setting a message after removal", () => {
      manager.set("home/light", encode("ON"), 1);
      manager.remove("home/light");
      manager.set("home/light", encode("OFF"), 2);

      expectMessages("home/light", [
        { topic: "home/light", payload: encode("OFF"), qos: 2 },
      ]);
    });

    it("should remove only the exact topic, not its descendants", () => {
      manager.set("home", encode("root"), 0);
      manager.set("home/light", encode("ON"), 1);
      manager.set("home/light/state", encode("1"), 2);

      manager.remove("home");

      expectMessages("home/#", [
        { topic: "home/light", payload: encode("ON"), qos: 1 },
        { topic: "home/light/state", payload: encode("1"), qos: 2 },
      ]);
    });

    it("should not interpret wildcards in remove()", () => {
      manager.set("home/light", encode("ON"), 1);
      manager.set("home/temp", encode("22"), 2);

      manager.remove("home/#");

      expectMessages("home/#", [
        { topic: "home/light", payload: encode("ON"), qos: 1 },
        { topic: "home/temp", payload: encode("22"), qos: 2 },
      ]);
    });

    it("should return no messages after removing all retained messages", () => {
      manager.set("home/light", encode("ON"), 1);
      manager.set("home/temp", encode("22"), 2);

      manager.remove("home/light");
      manager.remove("home/temp");

      expectMessages("#", []);
    });
  });
});
