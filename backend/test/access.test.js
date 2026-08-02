import test from "node:test";
import assert from "node:assert/strict";
import { isBookingAssignedToAreaManager, normalizeManagerName, scopeBookingsForUser } from "../src/access.js";

test("normalizes abbreviated and full Area Manager names", () => {
  assert.equal(normalizeManagerName("Area Manager West"), "am west");
  assert.equal(normalizeManagerName("AM West"), "am west");
});

test("uses the canonical mapped Area Manager id even when the legacy Excel label differs", () => {
  const user = { id: "u-am-west", name: "Area Manager West" };
  assert.equal(isBookingAssignedToAreaManager({ amNameFromFile: "AM West", assignedAreaManagerId: "u-am-west" }, user), true);
  assert.equal(isBookingAssignedToAreaManager({ amNameFromFile: "AM North", assignedAreaManagerId: "u-am-west" }, user), true);
  assert.equal(isBookingAssignedToAreaManager({ amNameFromFile: "AM West", assignedAreaManagerId: "u-am-north" }, user), false);
});

test("falls back to the Excel AM name only when no mapped id exists", () => {
  const user = { id: "u-am-west", name: "Area Manager West" };
  assert.equal(isBookingAssignedToAreaManager({ amNameFromFile: "AM West", assignedAreaManagerId: "" }, user), true);
  assert.equal(isBookingAssignedToAreaManager({ amNameFromFile: "AM North", assignedAreaManagerId: "" }, user), false);
});

test("regional managers only receive assigned bookings from their region", () => {
  const bookings = [
    { id: "west", region: "West", assignedRegionalManagerId: "u-rm-west" },
    { id: "north", region: "North", assignedRegionalManagerId: "u-rm-west" },
    { id: "other", region: "West", assignedRegionalManagerId: "u-rm-other" }
  ];
  const user = { id: "u-rm-west", role: "Regional Manager", region: "West", status: "active" };
  assert.deepEqual(scopeBookingsForUser(bookings, user).map((booking) => booking.id), ["west"]);
});

test("national roles receive the national booking view", () => {
  const bookings = [{ id: "one" }, { id: "two" }];
  for (const role of ["Admin", "All India I", "All India II", "All India"]) {
    assert.equal(scopeBookingsForUser(bookings, { role, status: "active" }).length, 2);
  }
});

test("unknown and inactive roles receive no bookings", () => {
  const bookings = [{ id: "one" }];
  assert.deepEqual(scopeBookingsForUser(bookings, { role: "Territory Manager", status: "active" }), []);
  assert.deepEqual(scopeBookingsForUser(bookings, { role: "All India", status: "inactive" }), []);
});
