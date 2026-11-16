import { QoS } from "../../protocol/shared/types";
import { matchTopicFilter } from "./matchTopicFilter";
import { ISubscriptionManager } from "./types";

// Manages MQTT topic subscriptions for clients, including subscribing, unsubscribing, and finding subscribers for a topic.
export class SubscriptionManager implements ISubscriptionManager {
  // map of client IDs to their subscriptions, each subscription is a map of topic filters to its subscription QoS levels
  private readonly subs: Map<string, Map<string, QoS>> = new Map();

  /**
   * Subscribes a subscriber to a topic with the specified QoS level.
   * @param clientId The ID of the client subscribing to the topic.
   * @param topicFilter The topic filter to subscribe to.
   * @param qos The Quality of Service level for the subscription. Defaults to 0 if not specified.
   */
  public subscribe(clientId: string, topicFilter: string, qos: QoS = 0): void {
    const subscriptions = this.subs.has(clientId)
      ? this.subs.get(clientId)!
      : new Map<string, QoS>();

    subscriptions.set(topicFilter, qos);

    this.subs.set(clientId, subscriptions);
  }

  /**
   * Unsubscribes a subscriber from a topic or all topics if no topic is specified.
   * @param clientId The ID of the client unsubscribing from the topic(s).
   * @param topicFilter (optional) The topic filter to unsubscribe from. If not specified, unsubscribes from all topics.
   */
  public unsubscribe(clientId: string, topicFilter?: string): void {
    const subscriptions = this.subs.get(clientId);

    if (subscriptions === undefined) return;

    if (topicFilter === undefined) {
      subscriptions.clear(); // remove all subscriptions for this subscriber
    } else {
      subscriptions.delete(topicFilter); // remove the subscription for the specified topic
    }
  }

  /**
   * Gets all subscribers that are subscribed to the specified topic with their QoS levels.
   * If the topic matches multiple subscriptions of the same subscriber (e.g. overlapping topic filters),
   * the subscriber appears only once, with the maximum QoS among all matching subscriptions
   * (MQTT 3.1.1 specification, section 3.3.5).
   * @param topic The topic to get subscribers for.
   * @returns An array of objects containing the clientId and their maximum QoS level for the specified topic.
   */
  public getSubscribers(topic: string): { clientId: string; qos: QoS }[] {
    const subscribers: { clientId: string; qos: QoS }[] = [];

    for (const subscriber of this.subs.keys()) {
      const subs = this.subs.get(subscriber);

      // skip if subscriber has no subscriptions
      if (subs === undefined) continue;

      // get all matching subscriptions for the topic
      const subscriptions = Array.from(subs.entries());
      const matchingSubscriptions = subscriptions.filter(([topicFilter]) =>
        matchTopicFilter(topic, topicFilter)
      );

      // skip if subscriber has no matching subscriptions
      if (matchingSubscriptions.length === 0) continue;

      // find the maximum QoS of the matching subscriptions
      const qos = this.findMaxQos(matchingSubscriptions);

      subscribers.push({ clientId: subscriber, qos: qos });
    }

    return subscribers;
  }

  // helper function to find the maximum QoS
  private findMaxQos = (subscriptions: [string, QoS][]): QoS => {
    let maxQos: QoS = 0;

    for (const subscription of subscriptions) {
      const qos = subscription[1];

      if (qos > maxQos) {
        maxQos = qos;

        // skip if maximum QoS is reached
        if (qos === 2) break;
      }
    }

    return maxQos;
  };
}
