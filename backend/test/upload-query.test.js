import assert from "node:assert/strict";
import test from "node:test";
import { queryUploads } from "../src/upload-query.js";

function upload(id, overrides = {}) {
  return {
    id,
    uploadCategory: "user_import",
    originalFileName: `users-${id}.csv`,
    status: "completed",
    totalRows: Number(id),
    errors: [{ rawValue: "private@example.com" }],
    credentials: [{ temporaryPassword: "must-not-leak" }],
    createdAt: `2026-08-0${id}T00:00:00.000Z`,
    ...overrides
  };
}

test("upload query paginates deterministically and strips sensitive details", () => {
  const result = queryUploads([upload("1"), upload("2"), upload("3")], new URLSearchParams({ pageSize: "2" }));
  assert.deepEqual(result.uploads.map((item) => item.id), ["3", "2"]);
  assert.deepEqual(result.pagination, { page: 1, pageSize: 2, total: 3, totalPages: 2, hasNextPage: true });
  assert.equal("errors" in result.uploads[0], false);
  assert.equal("credentials" in result.uploads[0], false);
});

test("upload query filters category, status, and search", () => {
  const result = queryUploads(
    [upload("1"), upload("2", { uploadCategory: "booking_import", originalFileName: "priority.csv", status: "failed" })],
    new URLSearchParams({ category: "booking_import", status: "failed", search: "priority" }),
  );
  assert.deepEqual(result.uploads.map((item) => item.id), ["2"]);
});

for (const [query, code] of [
  [{ page: "0" }, "INVALID_PAGE"],
  [{ pageSize: "101" }, "INVALID_PAGE_SIZE"],
  [{ search: "x".repeat(201) }, "INVALID_SEARCH"],
  [{ sortKey: "errors" }, "INVALID_SORT_FIELD"],
  [{ sortDir: "sideways" }, "INVALID_SORT_DIRECTION"]
]) {
  test(`upload query rejects ${code}`, () => {
    assert.throws(
      () => queryUploads([], new URLSearchParams(query)),
      (error) => error.status === 422 && error.code === code,
    );
  });
}
