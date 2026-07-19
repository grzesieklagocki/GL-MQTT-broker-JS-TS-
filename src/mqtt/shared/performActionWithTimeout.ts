/**
 * Performs an action with a timeout. If the action does not complete within the specified timeout, it will reject with the provided timeout error.
 * @param action - The action to be performed, which should return a Promise.
 * @param timeoutSeconds - The timeout duration in seconds.
 * @param timeoutError - The error to be thrown if the action does not complete within the timeout.
 * @returns A Promise that resolves with the result of the action or rejects with the timeout error if the action takes too long.
 */
export const performActionWithTimeout = async <T>(
  action: () => Promise<T>,
  timeoutSeconds: number,
  timeoutError: Error
): Promise<T> => {
  let timeout;

  // never resolve the timeout promise
  // only reject with the timeout error on timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(timeoutError);
    }, timeoutSeconds * 1000);
  });

  try {
    // resolve the action or reject with timeout error if action takes too long
    return await Promise.race([action(), timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
};
