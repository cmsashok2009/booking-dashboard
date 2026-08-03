import assert from "node:assert/strict";
import test from "node:test";
import { queryUnreadNotifications } from "../src/notification-query.js";

function notification(id, overrides = {}) {
  return {
    id,
    title: `Notification ${id}`,
    message: `Message ${id}`,
    eventType: "booking_allocated",
    actorName: "Admin User",
    actorRole: "Admin",
    salesOrderId: `SO-${id}`,
    dealerCode: "D001",
    recipientUserIds: ["user-1"],
    readByUserIds: [],
    createdAt: `2026-08-${String(id).padStart(2, "0")}T10:00:00.000Z`,
    ...overrides
  };
}

function db(rows) {
  return { notifications: rows };
}

test("notification query returns a bounded newest page and exact unread count", () => {
  const result = queryUnreadNotifications(
    db([notification("1"), notification("2"), notification("3")]),
    "user-1",
    new URLSearchParams({ pageSize: "2" })
  );
  assert.deepEqual(
    result.notifications.map((item) => item.id),
    ["3", "2"]
  );
  assert.equal(result.unreadCount, 3);
  assert.equal('recipientUserIds' in result.notifications[0], false);
  assert.equal('readByUserIds' in result.notifications[0], false);
  assert.equal('actorUserId' in result.notifications[0], false);
  assert.deepEqual(result.pagination, {
    page: 1,
    pageSize: 2,
    total: 3,
    totalPages: 2,
    hasNextPage: true
  });
});

test("notification query scopes recipients and excludes read items", () => {
  const result = queryUnreadNotifications(
    db([
      notification("1"),
      notification("2", { recipientUserIds: ["user-2"] }),
      notification("3", { readByUserIds: ["user-1"] })
    ]),
    "user-1",
    new URLSearchParams()
  );
  assert.deepEqual(result.notifications.map((item) => item.id), ["1"]);
  assert.equal(result.unreadCount, 1);
});

test("notification query searches, filters, and sorts deterministically", () => {
  const rows = [
    notification("b", { title: "Dealer assigned", actorRole: "Area Manager" }),
    notification("a", { title: "Dealer assigned", actorRole: "Area Manager" }),
    notification("c", { title: "Regional update", eventType: "regional_inputs_updated" })
  ];
  const result = queryUnreadNotifications(
    db(rows),
    "user-1",
    new URLSearchParams({
      search: "dealer",
      eventType: "booking_allocated",
      sortKey: "actorRole",
      sortDir: "asc"
    })
  );
  assert.deepEqual(result.notifications.map((item) => item.id), ["a", "b"]);
  assert.equal(result.unreadCount, 3);
  assert.equal('recipientUserIds' in result.notifications[0], false);
  assert.equal('readByUserIds' in result.notifications[0], false);
  assert.equal('actorUserId' in result.notifications[0], false);
  assert.equal(result.pagination.total, 2);
});

for (const [query, code] of [
  [{ page: "0" }, "INVALID_PAGE"],
  [{ pageSize: "101" }, "INVALID_PAGE_SIZE"],
  [{ search: "x".repeat(201) }, "INVALID_SEARCH"],
  [{ eventType: "x".repeat(101) }, "INVALID_EVENT_TYPE"],
  [{ sortKey: "recipientUserIds" }, "INVALID_SORT_FIELD"],
  [{ sortDir: "sideways" }, "INVALID_SORT_DIRECTION"]
]) {
  test(`notification query rejects ${code}`, () => {
    assert.throws(
      () => queryUnreadNotifications(db([]), "user-1", new URLSearchParams(query)),
      (error) => error.status === 422 && error.code === code
    );
  });
}