import assert from "node:assert/strict";
import test from "node:test";
import { queryAdminUsers } from "../src/user-query.js";

const users = [
  { id: "3", name: "Charlie", email: "charlie@example.com", role: "Admin", region: "All", status: "active", passwordHash: "secret" },
  { id: "2", name: "bravo", email: "bravo@example.com", role: "Area Manager", region: "West", status: "inactive", passwordHash: "secret" },
  { id: "1", name: "Alpha", email: "alpha@example.com", role: "Area Manager", region: "West", status: "active", passwordHash: "secret" }
];

test("Admin user query filters, sorts, paginates, and strips password hashes", () => {
  const result = queryAdminUsers(users, new URLSearchParams({
    search: "a",
    role: "Area Manager",
    region: "West",
    sortKey: "name",
    sortDir: "desc",
    page: "1",
    pageSize: "1"
  }));
  assert.deepEqual(result.pagination, { page: 1, pageSize: 1, total: 2, totalPages: 2, hasNextPage: true });
  assert.equal(result.users[0].name, "bravo");
  assert.equal("passwordHash" in result.users[0], false);
});

test("Admin user query uses stable ordering for equal sort values", () => {
  const result = queryAdminUsers([
    { id: "b", name: "Same", email: "b@example.com" },
    { id: "a", name: "same", email: "a@example.com" }
  ], new URLSearchParams({ pageSize: "10" }));
  assert.deepEqual(result.users.map((user) => user.id), ["a", "b"]);
});

for (const [params, code] of [
  [{ page: "0" }, "INVALID_PAGE"],
  [{ pageSize: "101" }, "INVALID_PAGE_SIZE"],
  [{ sortKey: "passwordHash" }, "INVALID_SORT_FIELD"],
  [{ sortDir: "sideways" }, "INVALID_SORT_DIRECTION"],
  [{ search: "x".repeat(201) }, "INVALID_SEARCH"]
]) {
  test(`Admin user query rejects ${code}`, () => {
    assert.throws(
      () => queryAdminUsers(users, new URLSearchParams(params)),
      (error) => error.status === 422 && error.code === code
    );
  });
}
