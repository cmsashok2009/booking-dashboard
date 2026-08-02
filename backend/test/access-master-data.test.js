import test from "node:test";
import assert from "node:assert/strict";
import { createDealerCode, createRegion, ensureAccessMasterData } from "../src/access-master-data.js";
import { seedData, validateSingleUser } from "../src/validators.js";

test("access master data derives existing regions and dealer codes", () => {
  const db = seedData();
  db.regions = undefined;
  db.dealerCodes = undefined;

  assert.equal(ensureAccessMasterData(db), true);
  assert.ok(db.regions.some((item) => item.name === "West"));
  assert.ok(db.dealerCodes.some((item) => item.code === "ABCD"));
});

test("region creation normalizes values and rejects case-insensitive duplicates", () => {
  const db = seedData();
  ensureAccessMasterData(db);

  const created = createRegion(db, { name: "  North East  " }, "u-admin");
  const duplicate = createRegion(db, { name: "north east" }, "u-admin");

  assert.equal(created.region.name, "North East");
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.code, "REGION_EXISTS");
  assert.equal(db.auditLogs[0].action, "region_created");
});

test("dealer code creation requires an existing region and becomes valid for onboarding", () => {
  const db = seedData();
  ensureAccessMasterData(db);
  createRegion(db, { name: "North East" }, "u-admin");

  const invalidRegion = createDealerCode(db, { code: "NE-001", region: "Missing" }, "u-admin");
  const created = createDealerCode(db, { code: " ne-001 ", region: "north east" }, "u-admin");
  const duplicate = createDealerCode(db, { code: "NE-001", region: "North East" }, "u-admin");

  assert.equal(invalidRegion.code, "DEALER_REGION_INVALID");
  assert.equal(created.dealerCode.code, "NE-001");
  assert.equal(created.dealerCode.region, "North East");
  assert.equal(duplicate.code, "DEALER_CODE_EXISTS");
  assert.equal(db.auditLogs[0].action, "dealer_code_created");

  const validation = validateSingleUser({
    Name: "New Area",
    Email: "new.area.north.east@example.com",
    Role: "Area Manager",
    Region: "North East",
    "Dealer Code": "NE-001",
    "Reporting Manager Email": "rm.west@example.com",
    Status: "active"
  }, db);
  assert.equal(validation.errors.some((item) => item.columnName === "Dealer Code"), false);

  const mismatchedRegion = validateSingleUser({
    Name: "Wrong Region",
    Email: "wrong.region@example.com",
    Role: "Area Manager",
    Region: "West",
    "Dealer Code": "NE-001",
    "Reporting Manager Email": "rm.west@example.com",
    Status: "active"
  }, db);
  assert.ok(mismatchedRegion.errors.some(
    (item) => item.columnName === "Region" && item.errorMessage === "Region must be North East for Dealer Code NE-001"
  ));
});
