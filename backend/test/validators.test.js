import test from "node:test";
import assert from "node:assert/strict";
import {
  createBookingTemplate,
  createUserTemplate,
  parseCsv,
  reconcileSeededDemoUsers,
  seedData,
  upsertBookings,
  upsertUsers,
  validateBookingRows,
  validateSingleUser,
  validateUserUpdate,
  validateUserRows,
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
  assert.ok(
    validation.errors.some(
      (error) => error.errorMessage === "Required column is missing",
    ),
  );
});

test("booking upload rejects duplicate sales order ids", () => {
  const parsed = parseCsv(
    `${createBookingTemplate()}\nabcd,ravi,kumar,0,9999999,sob12367,2026-05-08,dd,nsul,West,open,New DUSTER,DUSTER ADVENTURE TCE 160 MT,PWHITE,NEW,VIN26,#N/A,UNMATCHED,0,AVL,ORDER,RPASS,COMB`,
  );
  const validation = validateBookingRows(parsed.rows);
  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some((error) =>
      error.errorMessage.includes("Duplicate Sales Order Id"),
    ),
  );
});

test("single user phone accepts only exactly 10 digits when supplied", () => {
  const db = seedData();
  const base = {
    Name: "Phone User",
    Email: "phone.user@example.com",
    Role: "Admin",
    Status: "active",
  };

  for (const Phone of [
    "123456789",
    "12345678901",
    "12345abcde",
    "+919876543210",
  ]) {
    const result = validateSingleUser({ ...base, Phone }, db);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some(
        (error) =>
          error.columnName === "Phone" &&
          error.errorMessage === "Phone must contain exactly 10 digits",
      ),
    );
  }

  assert.equal(
    validateSingleUser({ ...base, Phone: "9876543210" }, db).valid,
    true,
  );
  assert.equal(validateSingleUser(base, db).valid, true);
});
test("single user validation requires reporting manager for area manager", () => {
  const db = seedData();
  const result = validateSingleUser(
    {
      Name: "Area Person",
      Email: "area.person@example.com",
      Role: "Area Manager",
      Region: "West",
      Status: "active",
    },
    db,
  );
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some(
      (error) => error.columnName === "Reporting Manager Email",
    ),
  );
});

test("area manager may report to any active existing user", () => {
  const db = seedData();
  const result = validateSingleUser(
    {
      Name: "Area Person",
      Email: "area.person@example.com",
      Role: "Area Manager",
      Region: "West",
      "Reporting Manager Email": "all.india@example.com",
      Status: "active",
    },
    db,
  );
  assert.equal(result.valid, true);
});

test("single user validation rejects roles outside the database role catalog", () => {
  const db = seedData();
  const result = validateSingleUser(
    {
      Name: "Invalid Role User",
      Email: "invalid.role@example.com",
      Role: "Territory Manager",
      Region: "West",
      Status: "active",
    },
    db,
  );
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some(
      (error) =>
        error.columnName === "Role" && error.rawValue === "Territory Manager",
    ),
  );
  assert.ok(
    result.errors.some((error) => error.errorMessage.includes("Area Manager")),
  );
});

test("reporting manager must be the next role in the hierarchy", () => {
  const db = seedData();
  const result = validateSingleUser(
    {
      Name: "Regional Person",
      Email: "regional.person@example.com",
      Role: "Regional Manager",
      Region: "West",
      "Reporting Manager Email": "all.india@example.com",
      Status: "active",
    },
    db,
  );
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some(
      (error) =>
        error.errorMessage === "Regional Manager must report to All India I",
    ),
  );
});

test("all india does not require a region or reporting manager", () => {
  const db = seedData();
  const result = validateSingleUser(
    {
      Name: "National User",
      Email: "national.user@example.com",
      Role: "All India",
      Status: "active",
    },
    db,
  );
  assert.equal(result.valid, true);
});

test("all india hierarchy roles require a manager but not a region", () => {
  const db = seedData();
  const result = validateSingleUser(
    {
      Name: "All India One User",
      Email: "all.india.one.user@example.com",
      Role: "All India I",
      "Reporting Manager Email": "all.india2@example.com",
      Status: "active",
    },
    db,
  );
  assert.equal(result.valid, true);
});

test("all canonical roles are stored with hierarchy metadata", () => {
  const db = seedData();
  assert.deepEqual(
    db.roles.map((role) => role.name),
    [
      "Area Manager",
      "Regional Manager",
      "All India I",
      "All India II",
      "All India",
      "Admin",
    ],
  );
  assert.equal(
    db.roles.find((role) => role.code === "AM").managerRoleCode,
    "RM",
  );
  assert.equal(db.roles.find((role) => role.code === "ADMIN").isSystem, true);
});

test("user template creates pending users without returning or storing credentials", () => {
  const db = seedData();
  const parsed = parseCsv(createUserTemplate());
  const result = upsertUsers(db, parsed.rows, { fileName: "users.csv" });
  assert.equal(parsed.rows.length, 50);
  assert.equal(result.status, "completed");
  assert.equal(result.insertedRows, 50);
  assert.equal("credentials" in result, false);
  assert.equal(db.fileUploads[0].credentials, undefined);
  assert.equal(
    db.users.filter((user) => user.status === "pending_invitation").length,
    50,
  );
});

test("bulk user upload rejects duplicate emails", () => {
  const db = seedData();
  const csv = `${createUserTemplate()}\nArea Manager Duplicate,mock.user01@example.com,9999990010,Area Manager,West,abcd,rm.west@example.com,active,`;
  const parsed = parseCsv(csv);
  const result = validateUserRows(parsed.rows, db);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some(
      (error) => error.errorMessage === "Duplicate email in upload",
    ),
  );
});

test("user update rejects empty editable fields", () => {
  const db = seedData();
  const result = validateUserUpdate(
    { name: "", email: "", role: "", region: "", status: "" },
    db,
    "u-am-west",
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.columnName === "Name"));
  assert.ok(result.errors.some((error) => error.columnName === "Email"));
  assert.ok(result.errors.some((error) => error.columnName === "Region"));
});

test("user update requires an incompatible Dealer Code to be cleared with a Region change", () => {
  const db = seedData();
  const user = db.users.find((item) => item.id === "u-am-west");
  user.dealerCode = "ABCD";
  db.regions = [
    { id: "region-current", name: user.region, status: "active" },
    { id: "region-new", name: "New Region", status: "active" },
  ];
  db.dealerCodes = [
    {
      id: "dealer-current",
      code: user.dealerCode,
      region: user.region,
      status: "active",
    },
  ];

  const retained = validateUserUpdate({ region: "New Region" }, db, user.id);
  assert.equal(retained.valid, false);
  assert.ok(
    retained.errors.some(
      (error) =>
        error.columnName === "Region" && error.errorMessage.includes("ABCD"),
    ),
  );

  const cleared = validateUserUpdate(
    { region: "New Region", dealerCode: "" },
    db,
    user.id,
  );
  assert.equal(cleared.valid, true);
  assert.equal(cleared.value.Region, "New Region");
  assert.equal(cleared.value["Dealer Code"], "");
});
test("user update rejects another user's email", () => {
  const db = seedData();
  const result = validateUserUpdate(
    { email: "admin@example.com" },
    db,
    "u-am-west",
  );
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => error.errorMessage.includes("another user")),
  );
});

test("user update locks login email after invitation while allowing other profile edits", () => {
  const db = seedData();
  const user = db.users.find((item) => item.id === "u-am-west");
  user.status = "invited";

  const emailChange = validateUserUpdate(
    { email: "new.am@example.com" },
    db,
    user.id,
  );
  assert.equal(emailChange.valid, false);
  assert.ok(
    emailChange.errors.some(
      (error) =>
        error.columnName === "Email" &&
        error.errorMessage.includes("cannot be changed"),
    ),
  );

  const nameChange = validateUserUpdate(
    { name: "Area Manager Updated" },
    db,
    user.id,
  );
  assert.equal(nameChange.valid, true);
});

test("active users without an issued invitation can correct their email", () => {
  const db = seedData();
  const user = db.users.find((item) => item.id === "u-am-west");
  const result = validateUserUpdate(
    { email: "corrected.am@example.com" },
    db,
    user.id,
  );
  assert.equal(result.valid, true);
});

test("lookup option updates should remove blanks and duplicates", () => {
  const options = ["TO BE CANCELLED", "", "TO BE CANCELLED", "NOT YET DECIDED"]
    .map((item) => item.trim())
    .filter(Boolean);
  const uniqueOptions = [...new Set(options)];
  assert.deepEqual(uniqueOptions, ["TO BE CANCELLED", "NOT YET DECIDED"]);
});

test("production reconciliation removes only unchanged seeded demo users", () => {
  const seeded = seedData();
  const customUser = {
    id: "u-custom",
    name: "Custom User",
    email: "custom@example.com",
    role: "Area Manager",
    status: "active",
  };
  const changedSeedIdentity = {
    ...seeded.users.find((user) => user.id === "u-am-west"),
    email: "real.manager@company.test",
  };
  const data = {
    users: [
      ...seeded.users.filter((user) => user.id !== "u-am-west"),
      changedSeedIdentity,
      customUser,
    ],
  };

  const changed = reconcileSeededDemoUsers(data, seeded.users, false);

  assert.equal(changed, true);
  assert.equal(
    data.users.some((user) => user.email === "am.central@example.com"),
    false,
  );
  assert.equal(
    data.users.some((user) => user.email === "real.manager@company.test"),
    true,
  );
  assert.equal(
    data.users.some((user) => user.id === "u-custom"),
    true,
  );
  assert.equal(
    data.users.some((user) => user.id === "u-admin"),
    true,
  );
});

test("single and bulk validation reject inactive or unknown reference data", () => {
  const db = seedData();
  db.regions = [{ id: "region-west", name: "West", status: "inactive" }];
  db.dealerCodes = [
    { id: "dealer-abcd", code: "ABCD", region: "West", status: "inactive" },
  ];
  const row = {
    Name: "Reference Test",
    Email: "reference.test@example.com",
    Role: "Area Manager",
    Region: "West",
    "Dealer Code": "ABCD",
    "Reporting Manager Email": "rm.west@example.com",
    Status: "active",
  };
  const single = validateSingleUser(row, db);
  const bulk = validateUserRows([row], db);
  assert.equal(single.valid, false);
  assert.equal(bulk.valid, false);
  assert.ok(
    single.errors.some(
      (error) =>
        error.columnName === "Region" &&
        error.errorMessage.includes("Reference Data"),
    ),
  );
  assert.ok(single.errors.some((error) => error.columnName === "Dealer Code"));
});
