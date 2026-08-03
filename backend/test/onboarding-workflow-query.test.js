import assert from "node:assert/strict";
import test from "node:test";
import { queryOnboardingWorkflows } from "../src/onboarding-workflow-query.js";

function workflow(id, overrides = {}) {
  return {
    id,
    fileName: `batch-${id}.csv`,
    ownerUserId: "admin-1",
    status: "validation_review",
    currentStep: "validation",
    rows: [{ source: { Email: "private@example.com" } }],
    createdAt: `2026-08-0${id}T00:00:00.000Z`,
    updatedAt: `2026-08-0${id}T00:00:00.000Z`,
    ...overrides,
  };
}

test("workflow query scopes owners, paginates, and omits uploaded rows", () => {
  const result = queryOnboardingWorkflows(
    [workflow("1"), workflow("2"), workflow("3", { ownerUserId: "admin-2" })],
    "admin-1",
    new URLSearchParams({ pageSize: "1" }),
  );
  assert.deepEqual(result.pagination, { page: 1, pageSize: 1, total: 2, totalPages: 2, hasNextPage: true });
  assert.equal(result.workflows[0].id, "2");
  assert.equal("rows" in result.workflows[0], false);
});

test("workflow query filters status and search with stable order", () => {
  const result = queryOnboardingWorkflows(
    [workflow("1"), workflow("2", { fileName: "priority.csv", status: "template_selection" })],
    "admin-1",
    new URLSearchParams({ search: "priority", status: "template_selection" }),
  );
  assert.deepEqual(result.workflows.map((item) => item.id), ["2"]);
});

for (const [query, code] of [
  [{ page: "0" }, "INVALID_PAGE"],
  [{ pageSize: "101" }, "INVALID_PAGE_SIZE"],
  [{ search: "x".repeat(201) }, "INVALID_SEARCH"],
  [{ sortKey: "rows" }, "INVALID_SORT_FIELD"],
  [{ sortDir: "sideways" }, "INVALID_SORT_DIRECTION"],
]) {
  test(`workflow query rejects ${code}`, () => {
    assert.throws(
      () => queryOnboardingWorkflows([], "admin-1", new URLSearchParams(query)),
      (error) => error.status === 422 && error.code === code,
    );
  });
}
