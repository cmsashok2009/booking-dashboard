import { createClient } from "redis";

const LUA_LIMIT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`;

export class MemoryRateLimiter {
  constructor() {
    this.buckets = new Map();
  }

  async check(key, identity, { limit, windowMs }) {
    const bucketKey = `${key}:${identity}`;
    const now = Date.now();
    const current = this.buckets.get(bucketKey);
    if (!current || current.resetAt <= now) {
      this.buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }
    current.count += 1;
    return {
      allowed: current.count <= limit,
      remaining: Math.max(0, limit - current.count),
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  async readiness() {
    return { ready: true, driver: "memory" };
  }

  async close() {}
}

export class RedisRateLimiter {
  constructor(url) {
    this.client = createClient({ url, socket: { connectTimeout: 2000, reconnectStrategy: (retries) => retries > 5 ? new Error("Redis reconnect limit reached") : Math.min(retries * 100, 1000) } });
    this.client.on("error", () => {});
    this.connecting = null;
  }

  async connect() {
    if (this.client.isReady) return;
    this.connecting ||= this.client.connect().finally(() => { this.connecting = null; });
    await this.connecting;
  }

  async check(key, identity, { limit, windowMs }) {
    await this.connect();
    const normalized = String(identity || "unknown").replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 180);
    const result = await this.client.eval(LUA_LIMIT, { keys: [`booking:limit:${key}:${normalized}`], arguments: [String(windowMs)] });
    const count = Number(result[0]);
    const ttl = Number(result[1]);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000))
    };
  }

  async readiness() {
    try {
      await this.connect();
      return { ready: (await this.client.ping()) === "PONG", driver: "redis" };
    } catch (error) {
      return { ready: false, driver: "redis", code: error.code || "REDIS_UNAVAILABLE" };
    }
  }

  async close() {
    if (this.client.isOpen) await this.client.quit();
  }
}

export function createRateLimiter(environment = process.env) {
  const driver = String(environment.RATE_LIMIT_DRIVER || (environment.NODE_ENV === "production" ? "redis" : "memory")).toLowerCase();
  if (driver === "memory") return new MemoryRateLimiter();
  if (driver === "redis") {
    if (!environment.REDIS_URL) throw new Error("REDIS_URL is required when RATE_LIMIT_DRIVER=redis");
    return new RedisRateLimiter(environment.REDIS_URL);
  }
  throw new Error(`Unsupported RATE_LIMIT_DRIVER: ${driver}`);
}

