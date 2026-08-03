import test from "node:test";
import assert from "node:assert/strict";
import { prepareLegacyState, reconcileStates, stateChecksum, stateInventory, validateLegacyState } from "../src/state-migration.js";

test("state checksum is deterministic across object key order", () => {
  const left = { users: [{ id: "u1", name: "Admin" }], revision: 2 };
  const right = { revision: 2, users: [{ name: "Admin", id: "u1" }] };
  assert.equal(stateChecksum(left), stateChecksum(right));
});

test("legacy validation rejects malformed roots and duplicate IDs", () => {
  assert.throws(() => validateLegacyState([]), /JSON object/);
  assert.throws(() => validateLegacyState({ users: [{ id: "u1" }, { id: "u1" }] }), /users:u1/);
  assert.throws(() => validateLegacyState({ lookupOptions: { category: {} } }), /must be an array/);
});

test("inventory and reconciliation cover collections and lookup options", () => {
  const state = { users: [{ id: "u1" }], bookings: [{ id: "b1" }, { id: "b2" }], lookupOptions: { category: [{ id: "o1" }], planning: [{ id: "o2" }] } };
  assert.deepEqual(stateInventory(state), { users: 1, bookings: 2, lookupOptions: 2 });
  assert.equal(reconcileStates(state, structuredClone(state)).matches, true);
  assert.equal(reconcileStates(state, { ...state, bookings: [] }).matches, false);
});
test("legacy preparation deterministically materializes access master data", () => {
  const legacy = {
    users: [{ id: "u1", region: "West" }],
    bookings: [{ id: "b1", dealerCode: "ABCD", region: "West" }],
    dealerAssignments: [{ id: "a1", dealerCode: "ABCD", region: "West" }],
  };
  const first = prepareLegacyState(legacy);
  const second = prepareLegacyState(legacy);
  assert.equal(first.regions.length, 1);
  assert.equal(first.dealerCodes.length, 1);
  assert.equal(first.dealerCodes[0].region, "West");
  assert.equal(stateChecksum(first), stateChecksum(second));
});
test("template versions use composite identity during duplicate validation", () => {
  assert.doesNotThrow(() => validateLegacyState({
    emailTemplateVersions: [
      { id: "t1", templateId: "t1", version: 1 },
      { id: "t1", templateId: "t1", version: 2 },
    ],
  }));
  assert.throws(() => validateLegacyState({
    emailTemplateVersions: [
      { id: "t1", templateId: "t1", version: 2 },
      { id: "t1", templateId: "t1", version: 2 },
    ],
  }), /emailTemplateVersions:t1:2/);
});