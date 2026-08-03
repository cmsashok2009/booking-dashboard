import assert from "node:assert/strict";
import test from "node:test";
import { queryEmailCampaigns } from "../src/email-campaign-query.js";

function campaign(id, overrides = {}) {
  return {
    id,
    status: "completed",
    sent: 1,
    failed: 0,
    total: 1,
    createdAt: `2026-08-0${id}.000Z`,
    recipients: [
      {
        id: `r-${id}`,
        name: `User ${id}`,
        email: `user${id}@example.test`,
        provider: "gmail",
        status: "sent",
      },
    ],
    ...overrides,
  };
}

test("campaign query defaults to newest-first bounded pages", () => {
  const result = queryEmailCampaigns(
    [campaign("1"), campaign("2"), campaign("3")],
    new URLSearchParams({ pageSize: "2" }),
  );
  assert.deepEqual(
    result.campaigns.map((item) => item.id),
    ["3", "2"],
  );
  assert.deepEqual(result.pagination, {
    page: 1,
    pageSize: 2,
    total: 3,
    totalPages: 2,
    hasNextPage: true,
  });
  assert.deepEqual(result.summary, { campaigns: 3, sent: 3, failed: 0 });
});

test("campaign query searches recipients and filters outcomes", () => {
  const rows = [
    campaign("1"),
    campaign("2", {
      failed: 1,
      sent: 0,
      recipients: [{ email: "failed@example.test", status: "failed" }],
    }),
  ];
  assert.deepEqual(
    queryEmailCampaigns(
      rows,
      new URLSearchParams({ search: "failed@", status: "failed" }),
    ).campaigns.map((item) => item.id),
    ["2"],
  );
  assert.equal(
    queryEmailCampaigns(rows, new URLSearchParams({ status: "successful" }))
      .pagination.total,
    1,
  );
});

test("campaign query supports allowlisted deterministic sorting", () => {
  const rows = [
    campaign("b", { failed: 2 }),
    campaign("a", { failed: 2 }),
    campaign("c", { failed: 0 }),
  ];
  assert.deepEqual(
    queryEmailCampaigns(
      rows,
      new URLSearchParams({ sortKey: "failed", sortDir: "desc" }),
    ).campaigns.map((item) => item.id),
    ["a", "b", "c"],
  );
});

for (const [query, code] of [
  [{ page: "0" }, "INVALID_PAGE"],
  [{ pageSize: "101" }, "INVALID_PAGE_SIZE"],
  [{ search: "x".repeat(201) }, "INVALID_SEARCH"],
  [{ status: "unknown" }, "INVALID_STATUS"],
  [{ sortKey: "recipients" }, "INVALID_SORT_FIELD"],
  [{ sortDir: "sideways" }, "INVALID_SORT_DIRECTION"],
]) {
  test(`campaign query rejects ${code}`, () => {
    assert.throws(
      () => queryEmailCampaigns([], new URLSearchParams(query)),
      (error) => error.status === 422 && error.code === code,
    );
  });
}
