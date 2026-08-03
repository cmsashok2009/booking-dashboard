import assert from "node:assert/strict";
import test from "node:test";
import { queryEmailTemplates } from "../src/email-template-query.js";

function template(id, overrides = {}) {
  return {
    id,
    name: `Template ${id}`,
    subject: `Subject ${id}`,
    type: "user_activation",
    status: "active",
    version: Number(id) || 1,
    updatedAt: `2026-08-0${id}T10:00:00.000Z`,
    ...overrides,
  };
}

test("template query returns bounded newest pages and global summary", () => {
  const result = queryEmailTemplates(
    [template("1"), template("2", { status: "draft" }), template("3")],
    new URLSearchParams({ pageSize: "2" }),
  );
  assert.deepEqual(
    result.templates.map((item) => item.id),
    ["3", "2"],
  );
  assert.deepEqual(result.pagination, {
    page: 1,
    pageSize: 2,
    total: 3,
    totalPages: 2,
    hasNextPage: true,
  });
  assert.deepEqual(result.summary, { total: 3, active: 2, draft: 1 });
});

test("template query searches and filters organization templates", () => {
  const rows = [
    template("1"),
    template("2", { name: "Dealer welcome", status: "draft" }),
  ];
  assert.deepEqual(
    queryEmailTemplates(
      rows,
      new URLSearchParams({
        search: "dealer",
        status: "draft",
        type: "user_activation",
      }),
    ).templates.map((item) => item.id),
    ["2"],
  );
});

test("template query supports deterministic numeric sorting", () => {
  const rows = [
    template("b", { version: 2 }),
    template("a", { version: 2 }),
    template("c", { version: 1 }),
  ];
  assert.deepEqual(
    queryEmailTemplates(
      rows,
      new URLSearchParams({ sortKey: "version", sortDir: "desc" }),
    ).templates.map((item) => item.id),
    ["a", "b", "c"],
  );
});

for (const [query, code] of [
  [{ page: "0" }, "INVALID_PAGE"],
  [{ pageSize: "101" }, "INVALID_PAGE_SIZE"],
  [{ search: "x".repeat(201) }, "INVALID_SEARCH"],
  [{ sortKey: "bodyHtml" }, "INVALID_SORT_FIELD"],
  [{ sortDir: "sideways" }, "INVALID_SORT_DIRECTION"],
]) {
  test(`template query rejects ${code}`, () => {
    assert.throws(
      () => queryEmailTemplates([], new URLSearchParams(query)),
      (error) => error.status === 422 && error.code === code,
    );
  });
}
