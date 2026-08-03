import assert from "node:assert/strict";
import test from "node:test";
import { emailDeliveryPolicy, executeEmailDelivery } from "../src/email-delivery-policy.js";

test("email delivery policy clamps unsafe environment values", () => {
  assert.deepEqual(
    emailDeliveryPolicy({
      EMAIL_DELIVERY_TIMEOUT_MS: "10",
      EMAIL_DELIVERY_MAX_ATTEMPTS: "99",
      EMAIL_DELIVERY_BASE_DELAY_MS: "1",
      EMAIL_DELIVERY_MAX_DELAY_MS: "999999"
    }),
    { timeoutMs: 1_000, maxAttempts: 5, baseDelayMs: 50, maxDelayMs: 30_000 }
  );
});

test("retries a known pre-acceptance failure with bounded jitter", async () => {
  let calls = 0;
  const delays = [];
  const result = await executeEmailDelivery(async () => {
    calls += 1;
    if (calls === 1) {
      const error = new Error("provider busy");
      error.code = "PROVIDER_BUSY";
      error.retryable = true;
      error.deliveryMayHaveSucceeded = false;
      throw error;
    }
    return { provider: "test", reference: "accepted-once" };
  }, {
    policy: { timeoutMs: 1_000, maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 500 },
    random: () => 0.5,
    sleep: async (delay) => delays.push(delay)
  });

  assert.equal(calls, 2);
  assert.deepEqual(delays, [50]);
  assert.equal(result.attemptCount, 2);
  assert.deepEqual(result.retryEvents, [{ attempt: 1, code: "PROVIDER_BUSY", delayMs: 50 }]);
});

test("does not retry an ambiguous provider timeout", async () => {
  let calls = 0;
  await assert.rejects(
    executeEmailDelivery(async () => {
      calls += 1;
      return new Promise(() => {});
    }, {
      policy: { timeoutMs: 10, maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
      sleep: async () => {}
    }),
    (error) => {
      assert.equal(error.code, "EMAIL_DELIVERY_TIMEOUT");
      assert.equal(error.deliveryMayHaveSucceeded, true);
      assert.equal(error.attemptCount, 1);
      return true;
    }
  );
  assert.equal(calls, 1);
});

test("records every bounded retry before terminal failure", async () => {
  let calls = 0;
  await assert.rejects(
    executeEmailDelivery(async () => {
      calls += 1;
      const error = new Error("still unavailable");
      error.code = "PROVIDER_UNAVAILABLE";
      error.retryable = true;
      error.deliveryMayHaveSucceeded = false;
      throw error;
    }, {
      policy: { timeoutMs: 1_000, maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 20 },
      random: () => 1,
      sleep: async () => {}
    }),
    (error) => {
      assert.equal(error.attemptCount, 3);
      assert.deepEqual(error.retryEvents, [
        { attempt: 1, code: "PROVIDER_UNAVAILABLE", delayMs: 10 },
        { attempt: 2, code: "PROVIDER_UNAVAILABLE", delayMs: 20 }
      ]);
      return true;
    }
  );
  assert.equal(calls, 3);
});
