import assert from "node:assert/strict";
import test from "node:test";
import { MySqlStateStore, PersistenceConflictError } from "../src/state-store.js";
import { RedisRateLimiter } from "../src/rate-limiter.js";

test("MySQL store commits one concurrent writer and rejects the stale writer", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const store = new MySqlStateStore({ DATABASE_URL: process.env.TEST_DATABASE_URL, DB_POOL_SIZE: "4" });
  try {
    await store.migrate();
    const initial = await store.initialize('{"encrypted":"fixture"}');
    const results = await Promise.allSettled([
      store.save('{"encrypted":"writer-a"}', initial.version),
      store.save('{"encrypted":"writer-b"}', initial.version)
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejection = results.find((result) => result.status === "rejected");
    assert.ok(rejection.reason instanceof PersistenceConflictError);
    assert.match((await store.load()).payload, /writer-[ab]/);
    assert.equal((await store.readiness()).ready, true);
  } finally {
    await store.close();
  }
});

test("Redis limiter shares a budget between independent instances", { skip: !process.env.TEST_REDIS_URL }, async () => {
  const first = new RedisRateLimiter(process.env.TEST_REDIS_URL);
  const second = new RedisRateLimiter(process.env.TEST_REDIS_URL);
  const identity = `integration-${Date.now()}`;
  try {
    assert.equal((await first.check("login", identity, { limit: 2, windowMs: 30000 })).allowed, true);
    assert.equal((await second.check("login", identity, { limit: 2, windowMs: 30000 })).allowed, true);
    assert.equal((await first.check("login", identity, { limit: 2, windowMs: 30000 })).allowed, false);
    assert.equal((await second.readiness()).ready, true);
  } finally {
    await Promise.all([first.close(), second.close()]);
  }
});
