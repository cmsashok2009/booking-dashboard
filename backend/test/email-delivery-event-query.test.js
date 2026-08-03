import assert from "node:assert/strict";
import test from "node:test";
import { queryEmailDeliveryEvents } from "../src/email-delivery-event-query.js";

function event(id, overrides = {}) {
  return {
    id,
    campaignId: "campaign-1",
    recipientId: `recipient-${id}`,
    userId: `user-${id}`,
    eventType: "sent",
    provider: "gmail",
    providerReference: "private-provider-reference",
    createdAt: `2026-08-0${id}T00:00:00.000Z`,
    ...overrides
  };
}

test("delivery event query paginates and strips user/provider references", () => {
  const result = queryEmailDeliveryEvents([event("1"), event("2"), event("3")], new URLSearchParams({ pageSize: "2" }));
  assert.deepEqual(result.events.map((item) => item.id), ["3", "2"]);
  assert.deepEqual(result.pagination, { page: 1, pageSize: 2, total: 3, totalPages: 2, hasNextPage: true });
  assert.equal("userId" in result.events[0], false);
  assert.equal("providerReference" in result.events[0], false);
});

test("delivery event query filters campaign, event, provider, and search", () => {
  const result = queryEmailDeliveryEvents(
    [event("1"), event("2", { campaignId: "campaign-2", eventType: "failed", provider: "smtp", failureReason: "TIMEOUT" })],
    new URLSearchParams({ campaignId: "campaign-2", eventType: "failed", provider: "smtp", search: "timeout" }),
  );
  assert.deepEqual(result.events.map((item) => item.id), ["2"]);
});

for (const [query, code] of [
  [{ page: "0" }, "INVALID_PAGE"],
  [{ pageSize: "101" }, "INVALID_PAGE_SIZE"],
  [{ search: "x".repeat(201) }, "INVALID_SEARCH"],
  [{ sortKey: "providerReference" }, "INVALID_SORT_FIELD"],
  [{ sortDir: "sideways" }, "INVALID_SORT_DIRECTION"]
]) {
  test(`delivery event query rejects ${code}`, () => {
    assert.throws(
      () => queryEmailDeliveryEvents([], new URLSearchParams(query)),
      (error) => error.status === 422 && error.code === code,
    );
  });
}
