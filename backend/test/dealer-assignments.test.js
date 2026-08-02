import test from "node:test";
import assert from "node:assert/strict";
import { dealerAssignmentForCode, ensureDealerAssignments } from "../src/dealer-assignments.js";
import { createBookingTemplate, parseCsv, seedData, upsertBookings } from "../src/validators.js";

test("seed data has one canonical manager mapping for every dealer", () => {
  const db = seedData();
  const dealerCodes = new Set(db.bookings.map((booking) => booking.dealerCode.toUpperCase()));
  assert.equal(db.dealerAssignments.length, dealerCodes.size);
  for (const booking of db.bookings) {
    const assignment = dealerAssignmentForCode(db, booking.dealerCode);
    assert.ok(assignment);
    assert.equal(booking.assignedAreaManagerId, assignment.areaManagerUserId);
    assert.equal(booking.assignedRegionalManagerId, assignment.regionalManagerUserId);
    assert.equal(booking.region, assignment.region);
  }
});

test("dealer lookup is case insensitive and import resolves canonical manager ids", () => {
  const db = seedData();
  const assignment = dealerAssignmentForCode(db, "dlr002");
  assert.ok(assignment);
  const parsed = parseCsv(createBookingTemplate());
  const row = parsed.rows.find((item) => item["Dealer Code"] === "DLR002");
  row["Sales Order Id"] = "SO-MAPPED-NEW";
  const result = upsertBookings(db, [row], { fileName: "mapped.csv" });
  const booking = db.bookings.find((item) => item.salesOrderId === "SO-MAPPED-NEW");
  assert.equal(result.status, "completed");
  assert.equal(booking.assignedAreaManagerId, assignment.areaManagerUserId);
  assert.equal(booking.assignedRegionalManagerId, assignment.regionalManagerUserId);
});

test("import rejects an unmapped dealer instead of silently assigning a manager", () => {
  const db = seedData();
  const parsed = parseCsv(createBookingTemplate());
  const row = { ...parsed.rows[0], "Dealer Code": "UNKNOWN-DEALER", "Sales Order Id": "SO-UNKNOWN" };
  const result = upsertBookings(db, [row], { fileName: "unknown.csv" });
  assert.equal(result.status, "failed");
  assert.ok(result.errors.some((error) => error.columnName === "Dealer Code" && error.errorMessage.includes("mapping")));
  assert.equal(db.bookings.some((booking) => booking.salesOrderId === "SO-UNKNOWN"), false);
});

test("startup migration repairs stale booking ids from the dealer map", () => {
  const db = seedData();
  const booking = db.bookings[0];
  const assignment = dealerAssignmentForCode(db, booking.dealerCode);
  booking.assignedAreaManagerId = "stale-area";
  booking.assignedRegionalManagerId = "stale-regional";
  assert.equal(ensureDealerAssignments(db), true);
  assert.equal(booking.assignedAreaManagerId, assignment.areaManagerUserId);
  assert.equal(booking.assignedRegionalManagerId, assignment.regionalManagerUserId);
});