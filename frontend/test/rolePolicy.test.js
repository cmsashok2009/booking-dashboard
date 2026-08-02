import assert from "node:assert/strict";
import { test } from "vitest";

import {
  canEditAreaInputs,
  canEditRegionalInputs,
  canViewAreaInputs,
  canViewRegionalInputs
} from "../app/features/bookings/rolePolicy.js";

const roles = ["Admin", "Area Manager", "Regional Manager", "All India", "All India I", "All India II"];

test("area input visibility matches the supported role matrix", () => {
  for (const role of roles) assert.equal(canViewAreaInputs(role), true, role);
  assert.equal(canViewAreaInputs("Dealer"), false);
  assert.equal(canViewAreaInputs(undefined), false);
});

test("regional input visibility excludes area managers and dealers", () => {
  for (const role of roles.filter((role) => role !== "Area Manager"))
    assert.equal(canViewRegionalInputs(role), true, role);
  assert.equal(canViewRegionalInputs("Area Manager"), false);
  assert.equal(canViewRegionalInputs("Dealer"), false);
});

test("editing remains restricted to the role-specific manager", () => {
  assert.equal(canEditAreaInputs("Area Manager"), true);
  assert.equal(canEditAreaInputs("Admin"), false);
  assert.equal(canEditRegionalInputs("Regional Manager"), true);
  assert.equal(canEditRegionalInputs("Admin"), false);
});
