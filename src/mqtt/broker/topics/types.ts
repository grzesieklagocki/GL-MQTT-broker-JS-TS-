import { QoS } from "../../protocol/shared/types";

/** Manages client subscriptions and finds subscribers matching a topic. */
export interface ISubscriptionManager {
  subscribe(clientId: string, topicFilter: string, qos?: QoS): void;
  unsubscribe(clientId: string, topicFilter?: string): void;
  getSubscribers(topic: string): { clientId: string; qos: QoS }[];
}

export type RetainedMessage = {
  topic: string;
  payload: Uint8Array;
  qos: QoS;
};

/** Stores retained messages and retrieves them by topic filter. */
export interface IRetainedMessagesManager {
  get(topicFilter: string): RetainedMessage[];
  set(topic: string, payload: Uint8Array, qos: QoS): void;
  remove(topic: string): void;
}
