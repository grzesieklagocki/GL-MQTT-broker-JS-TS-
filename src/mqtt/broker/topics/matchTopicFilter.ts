/**
 * Checks if a topic matches a topic filter according to MQTT rules.
 * @param topic The topic to check.
 * @param topicFilter The topic filter to match.
 * @returns True if the topic matches the topic filter, false otherwise.
 */
export function matchTopicFilter(topic: string, topicFilter: string): boolean {
  const splitIntoSegments = (topic: string): string[] => topic.split("/");

  const topicSegments = splitIntoSegments(topic);
  const topicFilterSegments = splitIntoSegments(topicFilter);

  // Topics starting with $ must not match filters starting with a wildcard
  if (
    topicSegments[0].startsWith("$") &&
    (topicFilterSegments[0] === "+" || topicFilterSegments[0] === "#")
  )
    return false;

  const lastIndex = topicFilterSegments.length - 1;
  const endsWithHash = topicFilterSegments[lastIndex] === "#";
  const segmentsToCheck = endsWithHash ? lastIndex : lastIndex + 1;

  if (endsWithHash) {
    if (topicSegments.length < segmentsToCheck) return false;
  } else if (topicSegments.length !== segmentsToCheck) {
    return false;
  }

  for (let i = 0; i < segmentsToCheck; i++) {
    const segment = topicFilterSegments[i];

    // return false if the segment don't match and is not '+'
    if (segment !== topicSegments[i] && segment !== "+") return false;
  }

  return true;
}
