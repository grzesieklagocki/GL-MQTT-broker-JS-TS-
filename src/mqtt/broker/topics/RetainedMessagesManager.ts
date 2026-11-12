import { QoS } from "@src/mqtt/protocol/shared/types";
import { matchTopicFilter } from "./matchTopicFilter";

type RetainedMessage = { topic: string; payload: Uint8Array; qos: QoS };

export class RetainedMessagesManager {
  private messages: Map<string, { payload: Uint8Array; qos: QoS }> = new Map();

  /**
   * Get all retained messages matching the given topic filter.
   * @param topicFilter The topic filter to match against retained messages.
   * @returns An array of retained messages that match the topic filter.
   */
  public get(topicFilter: string): RetainedMessage[] {
    const matchingMessages: RetainedMessage[] = []; // for storing messages that match the topic filter

    for (const [topic, message] of this.messages) {
      if (matchTopicFilter(topic, topicFilter)) {
        matchingMessages.push({
          topic,
          payload: message.payload,
          qos: message.qos,
        });
      }
    }

    return matchingMessages;
  }

  /**
   * Set a retained message for the given topic. If the message is empty, the retained message is removed.
   * @param topic The topic for which to set the retained message.
   * @param payload The payload of the retained message. If empty, the retained message is removed.
   * @param qos The QoS level for the retained message.
   */
  public set(topic: string, payload: Uint8Array, qos: QoS): void {
    if (payload.length === 0) {
      this.remove(topic); // empty message, remove retained message
    } else {
      const message = { payload: payload, qos: qos };

      this.messages.set(topic, message); // set retained message for the topic
    }
  }

  /**
   * Remove the retained message for the given topic.
   * @param topic The topic for which to remove the retained message.
   */
  public remove(topic: string): void {
    this.messages.delete(topic);
  }
}
