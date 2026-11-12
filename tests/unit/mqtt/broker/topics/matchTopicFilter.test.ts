import { matchTopicFilter } from "@mqtt/broker/topics/matchTopicFilter";
import { describe, expect, it } from "vitest";

describe("matchTopicFilter", () => {
  const testCases: {
    topic: string;
    topicFilter: string;
    match: boolean;
  }[] = [
    // Exact match
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
  ];

  testCases.forEach(({ topic, topicFilter, match }) => {
    it(`topic "${topic}" with filter "${topicFilter}" should ${
      match ? "" : "not"
    } match`, () => {
      expect(matchTopicFilter(topic, topicFilter)).toBe(match);
    });
  });
});
