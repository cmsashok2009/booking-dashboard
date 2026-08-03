const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 5_000;

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function emailDeliveryPolicy(environment = process.env) {
  return {
    timeoutMs: boundedInteger(environment.EMAIL_DELIVERY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1_000, 60_000),
    maxAttempts: boundedInteger(environment.EMAIL_DELIVERY_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, 1, 5),
    baseDelayMs: boundedInteger(environment.EMAIL_DELIVERY_BASE_DELAY_MS, DEFAULT_BASE_DELAY_MS, 50, 5_000),
    maxDelayMs: boundedInteger(environment.EMAIL_DELIVERY_MAX_DELAY_MS, DEFAULT_MAX_DELAY_MS, 100, 30_000)
  };
}

function timeoutError() {
  const error = new Error("Email provider did not respond within the configured timeout");
  error.code = "EMAIL_DELIVERY_TIMEOUT";
  error.retryable = false;
  error.deliveryMayHaveSucceeded = true;
  return error;
}

async function attemptWithTimeout(operation, timeoutMs) {
  const controller = new AbortController();
  let timeout;
  try {
    return await Promise.race([
      operation({ signal: controller.signal }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(timeoutError());
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeEmailDelivery(operation, options = {}) {
  const policy = { ...emailDeliveryPolicy(options.environment), ...options.policy };
  const random = options.random || Math.random;
  const sleep = options.sleep || ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const retryEvents = [];

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      const result = await attemptWithTimeout(operation, policy.timeoutMs);
      return { ...result, attemptCount: attempt, retryEvents };
    } catch (error) {
      const code = String(error.code || "EMAIL_DELIVERY_FAILED");
      const canRetry = error.retryable === true && error.deliveryMayHaveSucceeded !== true && attempt < policy.maxAttempts;
      if (!canRetry) {
        error.code = code;
        error.attemptCount = attempt;
        error.retryEvents = retryEvents;
        throw error;
      }
      const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * (2 ** (attempt - 1)));
      const delayMs = Math.max(1, Math.round(ceiling * random()));
      retryEvents.push({ attempt, code, delayMs });
      await sleep(delayMs);
    }
  }
  throw new Error("Email delivery attempt loop exhausted");
}
