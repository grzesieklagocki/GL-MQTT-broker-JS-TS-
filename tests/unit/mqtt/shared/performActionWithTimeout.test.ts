import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { performActionWithTimeout } from "@mqtt/shared/performActionWithTimeout";

describe("performActionWithTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the action result when the action finishes before timeout", async () => {
    const action = vi.fn().mockResolvedValue("result");

    const promise = performActionWithTimeout(action, 5, new Error("timeout"));

    await expect(promise).resolves.toBe("result");

    expect(action).toHaveBeenCalledExactlyOnceWith();
  });

  it("waits for an asynchronous action result", async () => {
    const action = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          setTimeout(() => resolve(123), 2_000);
        })
    );

    const promise = performActionWithTimeout(action, 5, new Error("timeout"));

    let settled = false;

    void promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );

    await vi.advanceTimersByTimeAsync(1_999);

    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    await expect(promise).resolves.toBe(123);
  });

  it("rejects with the action error when the action rejects", async () => {
    const actionError = new Error("action failed");

    const action = vi.fn().mockRejectedValue(actionError);

    const promise = performActionWithTimeout(action, 5, new Error("timeout"));

    await expect(promise).rejects.toBe(actionError);
  });

  it("rejects when the action does not finish before timeout", async () => {
    const timeoutError = new Error("timeout");

    const action = vi.fn(() => new Promise<never>(() => {}));

    const promise = performActionWithTimeout(action, 5, timeoutError);

    const assertion = expect(promise).rejects.toBe(timeoutError);

    await vi.advanceTimersByTimeAsync(5_000);

    await assertion;
  });

  it("does not reject before the timeout expires", async () => {
    const timeoutError = new Error("timeout");

    const action = vi.fn(() => new Promise<never>(() => {}));

    const promise = performActionWithTimeout(action, 5, timeoutError);

    let settled = false;

    void promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );

    await vi.advanceTimersByTimeAsync(4_999);

    expect(settled).toBe(false);

    const assertion = expect(promise).rejects.toBe(timeoutError);

    await vi.advanceTimersByTimeAsync(1);

    await assertion;
  });

  it("keeps the timeout result when the action finishes after timeout", async () => {
    const timeoutError = new Error("timeout");

    const action = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve("too late"), 6_000);
        })
    );

    const promise = performActionWithTimeout(action, 5, timeoutError);

    const assertion = expect(promise).rejects.toBe(timeoutError);

    await vi.advanceTimersByTimeAsync(5_000);

    await assertion;

    // Akcja nadal działa, mimo że zewnętrzny Promise został odrzucony.
    await vi.advanceTimersByTimeAsync(1_000);

    // Drugie rozstrzygnięcie przez resolve("too late") jest ignorowane.
    await expect(promise).rejects.toBe(timeoutError);
  });

  it("rejects when the action throws synchronously", async () => {
    const actionError = new Error("synchronous error");

    const action = vi.fn((): Promise<unknown> => {
      throw actionError;
    });

    const promise = performActionWithTimeout(action, 5, new Error("timeout"));

    await expect(promise).rejects.toBe(actionError);
  });

  it("clears the timeout after the action resolves", async () => {
    const promise = performActionWithTimeout(
      () => Promise.resolve("result"),
      5,
      new Error("timeout")
    );

    await expect(promise).resolves.toBe("result");

    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the timeout after the action rejects", async () => {
    const actionError = new Error("action failed");

    const promise = performActionWithTimeout(
      () => Promise.reject(actionError),
      5,
      new Error("timeout")
    );

    await expect(promise).rejects.toBe(actionError);

    expect(vi.getTimerCount()).toBe(0);
  });
});
