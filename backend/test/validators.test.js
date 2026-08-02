import test from "node:test";
import assert from "node:assert/strict";
import {
  createBookingTemplate,
  createUserTemplate,
  parseCsv,
  seedData,
  upsertBookings,
  upsertUsers,
  validateBookingRows,
  validateSingleUser,
  validateUserUpdate,
  validateUserRows
} from "../src/validators.js";

test("booking template parses and imports without validation errors", () => {
  const db = seedData();
  const parsed = parseCsv(createBookingTemplate());
  const result = upsertBookings(db, parsed.rows, { fileName: "template.csv" });
  assert.equal(parsed.rows.length, 100);
  assert.equal(result.status, "completed");
  assert.equal(result.failedRows, 0);
  assert.equal(result.updatedRows, 100);
});

test("booking upload rejects missing required columns", () => {
  const parsed = parseCsv("Dealer Code,Sales Order Id\nabcd,sob1");
  const validation = validateBookingRows(parsed.rows);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.errorMessage === "Required column is missing"));
});

test("booking upload rejects duplicate sales order ids", () => {
  const parsed = parseCsv(`${createBookingTemplate()}\nabcd,ravi,kumar,0,9999999,sob12367,2026-05-08,dd,nsul,West,open,New DUSTER,DUSTER ADVENTURE TCE 160 MT,PWHITE,NEW,VIN26,#N/A,UNMATCHED,0,AVL,ORDER,RPASS,COMB`);
  const validation = validateBookingRows(parsed.rows);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.errorMessage.includes("Duplicate Sales Order Id")));
});

test("single user validation requires reporting manager for area manager", () => {
  const db = seedData();
  const result = validateSingleUser({
    Name: "Area Person",
    Email: "area.person@example.com",
    Role: "Area Manager",
    Region: "West",
    Status: "active"
  }, db);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.columnName === "Reporting Manager Email"));
});

test("single user validation rejects roles outside the database role catalog", () => {
  const db = seedData();
  const result = validateSingleUser({
    Name: "Invalid Role User",
    Email: "invalid.role@example.com",
    Role: "Territory Manager",
    Region: "West",
    Status: "active"
  }, db);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.columnName === "Role" && error.rawValue === "Territory Manager"));
  assert.ok(result.errors.some((error) => error.errorMessage.includes("Area Manager")));
});

test("reporting manager must be the next role in the hierarchy", () => {
  const db = seedData();
  const result = validateSingleUser({
    Name: "Regional Person",
    Email: "regional.person@example.com",
    Role: "Regional Manager",
    Region: "West",
    "Reporting Manager Email": "all.india@example.com",
    Status: "active"
  }, db);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.errorMessage === "Regional Manager must report to All India I"));
});

test("all india does not require a region or reporting manager", () => {
  const db = seedData();
  const result = validateSingleUser({
    Name: "National User",
    Email: "national.user@example.com",
    Role: "All India",
    Status: "active"
  }, db);
  assert.equal(result.valid, true);
});

test("all india hierarchy roles require a manager but not a region", () => {
  const db = seedData();
  const result = validateSingleUser({
    Name: "All India One User",
    Email: "all.india.one.user@example.com",
    Role: "All India I",
    "Reporting Manager Email": "all.india2@example.com",
    Status: "active"
  }, db);
  assert.equal(result.valid, true);
});

test("all canonical roles are stored with hierarchy metadata", () => {
  const db = seedData();
  assert.deepEqual(db.roles.map((role) => role.name), [
    "Area Manager", "Regional Manager", "All India I", "All India II", "All India", "Admin"
  ]);
  assert.equal(db.roles.find((role) => role.code === "AM").managerRoleCode, "RM");
  assert.equal(db.roles.find((role) => role.code === "ADMIN").isSystem, true);
});

test("user template creates a new user and credential", () => {
  const db = seedData();
  const parsed = parseCsv(createUserTemplate());
  const result = upsertUsers(db, parsed.rows, { fileName: "users.csv" });
  assert.equal(parsed.rows.length, 50);
  assert.equal(result.status, "completed");
  assert.equal(result.insertedRows, 50);
  assert.equal(result.credentials.length, 50);
});

test("bulk user upload rejects duplicate emails", () => {
  const db = seedData();
  const csv = `${createUserTemplate()}\nArea Manager Duplicate,mock.user01@example.com,9999990010,Area Manager,West,abcd,rm.west@example.com,active,`;
  const parsed = parseCsv(csv);
  const result = validateUserRows(parsed.rows, db);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.errorMessage === "Duplicate email in upload"));
});

test("user update rejects empty editable fields", () => {
  const db = seedData();
  const result = validateUserUpdate({ name: "", email: "", role: "", region: "", status: "" }, db, "u-am-west");
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.columnName === "Name"));
  assert.ok(result.errors.some((error) => error.columnName === "Email"));
  assert.ok(result.errors.some((error) => error.columnName === "Region"));
});

test("user update rejects another user's email", () => {
  const db = seedData();
  const result = validateUserUpdate({ email: "admin@example.com" }, db, "u-am-west");
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.errorMessage.includes("another user")));
});

test("user update locks login email after invitation while allowing other profile edits", () => {
  const db = seedData();
  const user = db.users.find((item) => item.id === "u-am-west");
  user.status = "invited";

  const emailChange = validateUserUpdate({ email: "new.am@example.com" }, db, user.id);
  assert.equal(emailChange.valid, false);
  assert.ok(emailChange.errors.some((error) => error.columnName === "Email" && error.errorMessage.includes("cannot be changed")));

  const nameChange = validateUserUpdate({ name: "Area Manager Updated" }, db, user.id);
  assert.equal(nameChange.valid, true);
});

test("active users without an issued invitation can correct their email", () => {
  const db = seedData();
  const user = db.users.find((item) => item.id === "u-am-west");
  const result = validateUserUpdate({ email: "corrected.am@example.com" }, db, user.id);
  assert.equal(result.valid, true);
});

test("lookup option updates should remove blanks and duplicates", () => {
  const options = ["TO BE CANCELLED", "", "TO BE CANCELLED", "NOT YET DECIDED"].map((item) => item.trim()).filter(Boolean);
  const uniqueOptions = [...new Set(options)];
  assert.deepEqual(uniqueOptions, ["TO BE CANCELLED", "NOT YET DECIDED"]);
});
