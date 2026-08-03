import assert from "node:assert/strict";
import test from "node:test";
import { queryAuditEvents } from "../src/audit-query.js";

function event(id, overrides = {}) {
  return {
    id,
    action: "user_created",
    entityType: "user",
    entityId: `user-${id}`,
    userId: "admin-1",
    outcome: { email: "private@example.com" },
    details: { token: "must-not-leak" },
    createdAt: `2026-08-0${id}T00:00:00.000Z`,
    ...overrides
  };
}

test("audit query returns bounded newest metadata without details or outcomes", () => {
  const result = queryAuditEvents([event("1"), event("2"), event("3")], new URLSearchParams({ pageSize: "2" }));
  assert.deepEqual(result.events.map((item) => item.id), ["3", "2"]);
  assert.deepEqual(result.pagination, { page: 1, pageSize: 2, total: 3, totalPages: 2, hasNextPage: true });
  assert.equal("outcome" in result.events[0], false);
  assert.equal("details" in result.events[0], false);
});

test("audit query searches and filters stable event metadata", () => {
  const result = queryAuditEvents(
    [event("1"), event("2", { action: "booking_updated", entityType: "booking", entityId: "SO-200" })],
    new URLSearchParams({ search: "SO-200", action: "booking_updated", entityType: "booking" }),
  );
  assert.deepEqual(result.events.map((item) => item.id), ["2"]);
});

for (const [query, code] of [
  [{ page: "0" }, "INVALID_PAGE"],
  [{ pageSize: "101" }, "INVALID_PAGE_SIZE"],
  [{ search: "x".repeat(201) }, "INVALID_SEARCH"],
  [{ sortKey: "details" }, "INVALID_SORT_FIELD"],
  [{ sortDir: "sideways" }, "INVALID_SORT_DIRECTION"]
]) {
  test(`audit query rejects ${code}`, () => {
    assert.throws(
      () => queryAuditEvents([], new URLSearchParams(query)),
      (error) => error.status === 422 && error.code === code,
    );
  });
}
