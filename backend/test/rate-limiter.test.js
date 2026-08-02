import assert from "node:assert/strict";
import test from "node:test";
import { MemoryRateLimiter, createRateLimiter } from "../src/rate-limiter.js";

test("memory limiter enforces a fixed-window request budget", async () => {
  const limiter = new MemoryRateLimiter();
  assert.equal((await limiter.check("login", "client", { limit: 2, windowMs: 1000 })).allowed, true);
  assert.equal((await limiter.check("login", "client", { limit: 2, windowMs: 1000 })).allowed, true);
  const blocked = await limiter.check("login", "client", { limit: 2, windowMs: 1000 });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
});

test("production requires Redis rate limiting", () => {
  assert.throws(() => createRateLimiter({ NODE_ENV: "production" }), /REDIS_URL/);
  assert.equal(createRateLimiter({ NODE_ENV: "test" }).constructor.name, "MemoryRateLimiter");
});
