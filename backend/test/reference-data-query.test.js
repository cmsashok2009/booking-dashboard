import assert from "node:assert/strict";
import test from "node:test";
import { queryReferenceData } from "../src/reference-data-query.js";

const db = {
  regions: [{ id: "r2", name: "West", status: "active" }, { id: "r1", name: "East", status: "inactive" }],
  dealerCodes: [{ id: "d1", code: "DLR1", region: "West", status: "active" }],
  dealerAssignments: [{ dealerCode: "DLR1", areaManagerUserId: "u1", regionalManagerUserId: "u2" }],
  roles: [{ code: "AM", name: "Area Manager", hierarchyLevel: 1, isActive: true }],
  lookupOptions: { bookingCategory: [{ id: "o1", label: "Priority", status: "active" }] }
};

test("reference query pages and filters projected collections", () => {
  const result = queryReferenceData(db, new URLSearchParams({ collection: "regions", pageSize: "1", status: "active" }));
  assert.deepEqual(result.items.map((item) => item.label), ["West"]);
  assert.deepEqual(result.pagination, { page: 1, pageSize: 1, total: 1, totalPages: 1, hasNextPage: false });
});

test("reference query supports field-scoped lookup options", () => {
  const result = queryReferenceData(db, new URLSearchParams({ collection: "lookupOptions", fieldCode: "bookingCategory" }));
  assert.deepEqual(result.items, [{ id: "o1", label: "Priority", status: "active", updatedAt: undefined }]);
});

for (const [query, code] of [
  [{ collection: "unknown" }, "INVALID_COLLECTION"],
  [{ collection: "lookupOptions", fieldCode: "unknown" }, "INVALID_FIELD_CODE"],
  [{ collection: "regions", page: "0" }, "INVALID_PAGE"],
  [{ collection: "regions", pageSize: "101" }, "INVALID_PAGE_SIZE"],
  [{ collection: "regions", search: "x".repeat(201) }, "INVALID_SEARCH"],
  [{ collection: "regions", sortKey: "secret" }, "INVALID_SORT_FIELD"],
  [{ collection: "regions", sortDir: "sideways" }, "INVALID_SORT_DIRECTION"]
]) {
  test(`reference query rejects ${code}`, () => {
    assert.throws(
      () => queryReferenceData(db, new URLSearchParams(query)),
      (error) => error.status === 422 && error.code === code,
    );
  });
}
