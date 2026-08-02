import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";

afterEach(() => vi.restoreAllMocks());

import { request } from "../app/utils/api.js";

test("request returns parsed JSON and sends a correlation ID", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_path, options) => {
    assert.match(options.headers["x-request-id"], /^\d+-[a-z0-9]+$/);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });
  assert.deepEqual(await request("/api/example", { timeoutMs: 50 }), { ok: true });
});

test("request emits sanitized correlation details for failures", async () => {
  const events = [];
  window.addEventListener("booking-api-error", ({ detail }) => events.push(detail), { once: true });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: "Rejected", secret: "must-not-be-emitted" }), {
      status: 503,
      headers: { "content-type": "application/json" }
    })
  );
  await assert.rejects(request("/api/failure", { timeoutMs: 50 }), (error) => {
    assert.equal(error.status, 503);
    assert.match(error.requestId, /^\d+-[a-z0-9]+$/);
    return true;
  });
  assert.deepEqual(Object.keys(events[0]).sort(), ["path", "recoverable", "requestId", "status"]);
  assert.deepEqual(events[0], {
    requestId: events[0].requestId,
    path: "/api/failure",
    status: 503,
    recoverable: true
  });
});

test("request reports timeouts as recoverable 408 errors", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    (_path, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      })
  );
  await assert.rejects(
    request("/api/slow", { timeoutMs: 5 }),
    (error) => error.name === "ApiRequestError" && error.status === 408 && error.recoverable
  );
});
