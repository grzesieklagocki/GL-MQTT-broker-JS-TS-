import { beforeEach, describe, expect, it } from "vitest";
import { SubscriptionManager } from "@mqtt/broker/topics/SubscriptionManager";
import { QoS } from "@mqtt/protocol/shared/types";

describe("SubscriptionManager", () => {
  let manager: SubscriptionManager;

  const client1 = "client1";
  const client2 = "client2";
  const client3 = "client3";

  // helper function to check expected subscribers for a topic
  const expectSubscribers = (
    topic: string,
    expected: { clientId: string; qos: QoS }[]
  ) => {
    const actual = manager.getSubscribers(topic);

    expect(actual).toHaveLength(expected.length);
    expect(actual).toEqual(expect.arrayContaining(expected));
  };

  beforeEach(() => {
    manager = new SubscriptionManager();
  });

  describe("subscribe", () => {
    it("should subscribe with default QoS 0", () => {
      manager.subscribe(client1, "home/light");

      expectSubscribers("home/light", [{ clientId: client1, qos: 0 }]);
    });

    it.each([0, 1, 2] as QoS[])("should subscribe with QoS %i", (qos) => {
      manager.subscribe(client1, "home/light", qos);

      expectSubscribers("home/light", [{ clientId: client1, qos }]);
    });

    it("should support multiple clients on the same filter", () => {
      manager.subscribe(client1, "home/light", 0);
      manager.subscribe(client2, "home/light", 1);
      manager.subscribe(client3, "home/light", 2);

      expectSubscribers("home/light", [
        { clientId: client1, qos: 0 },
        { clientId: client2, qos: 1 },
        { clientId: client3, qos: 2 },
      ]);
    });

    it("should support multiple filters for one client", () => {
      manager.subscribe(client1, "home/light", 1);
      manager.subscribe(client1, "garden/temp", 2);

      expectSubscribers("home/light", [{ clientId: client1, qos: 1 }]);
      expectSubscribers("garden/temp", [{ clientId: client1, qos: 2 }]);
    });

    it("should replace QoS when subscribing to the same filter again", () => {
      manager.subscribe(client1, "home/light", 2);
      manager.subscribe(client1, "home/light", 0);

      expectSubscribers("home/light", [{ clientId: client1, qos: 0 }]);
    });

    it("should not duplicate repeated subscriptions", () => {
      manager.subscribe(client1, "home/light", 1);
      manager.subscribe(client1, "home/light", 1);

      expectSubscribers("home/light", [{ clientId: client1, qos: 1 }]);
    });
  });

  describe("unsubscribe", () => {
    it("should remove a specific subscription", () => {
      manager.subscribe(client1, "home/light", 1);
      manager.subscribe(client1, "home/temp", 2);

      manager.unsubscribe(client1, "home/light");

      expectSubscribers("home/light", []);
      expectSubscribers("home/temp", [{ clientId: client1, qos: 2 }]);
    });

    it("should remove all subscriptions when no filter is specified", () => {
      manager.subscribe(client1, "home/light", 1);
      manager.subscribe(client1, "home/temp", 2);
      manager.subscribe(client2, "home/light", 0);

      manager.unsubscribe(client1);

      expectSubscribers("home/light", [{ clientId: client2, qos: 0 }]);
      expectSubscribers("home/temp", []);
    });

    it("should not affect other clients", () => {
      manager.subscribe(client1, "home/light", 1);
      manager.subscribe(client2, "home/light", 2);

      manager.unsubscribe(client1, "home/light");

      expectSubscribers("home/light", [{ clientId: client2, qos: 2 }]);
    });

    it("should not throw when unsubscribing a nonexistent filter", () => {
      expect(() => manager.unsubscribe(client1, "unknown/topic")).not.toThrow();
    });

    it("should not throw when unsubscribing an unknown client", () => {
      expect(() => manager.unsubscribe(client3)).not.toThrow();
    });

    it("should allow resubscribing after unsubscribe", () => {
      manager.subscribe(client1, "home/light", 1);
      manager.unsubscribe(client1, "home/light");
      manager.subscribe(client1, "home/light", 2);

      expectSubscribers("home/light", [{ clientId: client1, qos: 2 }]);
    });

    it("should preserve other overlapping filters after unsubscribe", () => {
      manager.subscribe(client1, "home/#", 1);
      manager.subscribe(client1, "home/light", 2);

      manager.unsubscribe(client1, "home/light");

      expectSubscribers("home/light", [{ clientId: client1, qos: 1 }]);
    });
  });

  describe("getSubscribers", () => {
    it("should return an empty array when no subscriptions match", () => {
      expectSubscribers("unknown/topic", []);
    });

    const matchCases: { topic: string; topicFilter: string; match: boolean }[] =
      [
        // Exact matches
        { topic: "home/light", topicFilter: "home/light", match: true },
        { topic: "home/light", topicFilter: "home/temp", match: false },
        { topic: "home/light", topicFilter: "home", match: false },

        // Single-level wildcard (+)
        { topic: "home/light", topicFilter: "home/+", match: true },
        { topic: "home/light/state", topicFilter: "home/+", match: false },
        { topic: "home/light/state", topicFilter: "+/light/+", match: true },
        { topic: "home/light", topicFilter: "+/+", match: true },
        { topic: "home/light", topicFilter: "+/+/+", match: false },

        // Multi-level wildcard (#)
        { topic: "home/light", topicFilter: "#", match: true },
        { topic: "home/light", topicFilter: "home/#", match: true },
        { topic: "home/light/state", topicFilter: "home/#", match: true },
        { topic: "home", topicFilter: "home/#", match: true },
        { topic: "home/light", topicFilter: "light/#", match: false },
        { topic: "home/light/state", topicFilter: "+/light/#", match: true },

        // Empty topic levels
        { topic: "home/", topicFilter: "home/+", match: true },
        { topic: "home/", topicFilter: "home/#", match: true },
        { topic: "/home", topicFilter: "+/home", match: true },
        { topic: "home//light", topicFilter: "home/+/light", match: true },

        // Reserved $ topics
        { topic: "$SYS/broker", topicFilter: "#", match: false },
        { topic: "$SYS/broker", topicFilter: "+/broker", match: false },
        { topic: "$SYS/broker", topicFilter: "$SYS/#", match: true },
        { topic: "$SYS/broker", topicFilter: "$SYS/+", match: true },
        { topic: "$SYS/broker", topicFilter: "$SYS/broker", match: true },
        { topic: "home/$SYS", topicFilter: "#", match: true },
      ];

    matchCases.forEach(({ topic, topicFilter, match }) => {
      it(`topic "${topic}" with filter "${topicFilter}" should ${
        match ? "" : "not"
      } match`, () => {
        manager.subscribe(client1, topicFilter, 1);

        expectSubscribers(topic, match ? [{ clientId: client1, qos: 1 }] : []);
      });
    });

    it("should return maximum QoS for overlapping filters", () => {
      manager.subscribe(client1, "home/#", 0);
      manager.subscribe(client1, "home/+", 2);
      manager.subscribe(client1, "home/light", 1);

      expectSubscribers("home/light", [{ clientId: client1, qos: 2 }]);
    });

    it("should not duplicate clients matching multiple filters", () => {
      manager.subscribe(client1, "#", 0);
      manager.subscribe(client1, "home/#", 1);
      manager.subscribe(client1, "home/light", 2);

      expectSubscribers("home/light", [{ clientId: client1, qos: 2 }]);
    });

    it("should calculate maximum QoS independently for each client", () => {
      manager.subscribe(client1, "home/#", 0);
      manager.subscribe(client1, "home/+", 2);

      manager.subscribe(client2, "home/#", 1);
      manager.subscribe(client2, "home/light", 0);

      expectSubscribers("home/light", [
        { clientId: client1, qos: 2 },
        { clientId: client2, qos: 1 },
      ]);
    });

    it("should recalculate maximum QoS after removing a filter", () => {
      manager.subscribe(client1, "home/#", 1);
      manager.subscribe(client1, "home/light", 2);

      manager.unsubscribe(client1, "home/light");

      expectSubscribers("home/light", [{ clientId: client1, qos: 1 }]);
    });

    it("should preserve case sensitivity", () => {
      manager.subscribe(client1, "Home/Light", 1);

      expectSubscribers("Home/Light", [{ clientId: client1, qos: 1 }]);
      expectSubscribers("home/light", []);
    });

    it("should treat whitespace as significant", () => {
      manager.subscribe(client1, "home /light", 1);

      expectSubscribers("home /light", [{ clientId: client1, qos: 1 }]);
      expectSubscribers("home/light", []);
    });

    it("should distinguish empty topic levels", () => {
      manager.subscribe(client1, "home//light", 1);

      expectSubscribers("home//light", [{ clientId: client1, qos: 1 }]);
      expectSubscribers("home/light", []);
    });

    it("should return an empty array after all subscriptions are removed", () => {
      manager.subscribe(client1, "home/#", 1);
      manager.subscribe(client2, "#", 2);

      manager.unsubscribe(client1);
      manager.unsubscribe(client2);

      expectSubscribers("home/light", []);
    });
  });
});
