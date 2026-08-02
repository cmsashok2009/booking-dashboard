import assert from "node:assert/strict";
import { test } from "vitest";

import {
  buildSingleUserPayload,
  getSingleUserRequirements,
  validateSingleUser
} from "../app/features/users/singleUser.js";

const definitions = [
  { name: "Area Manager", code: "AM", managerRoleCode: "RM" },
  { name: "Regional Manager", code: "RM" }
];

test("single-user requirements derive region and reporting hierarchy", () => {
  assert.deepEqual(getSingleUserRequirements("Area Manager", definitions), {
    needsRegion: true,
    needsManager: true,
    managerRole: "Regional Manager"
  });
  assert.deepEqual(getSingleUserRequirements("Admin", definitions), {
    needsRegion: false,
    needsManager: false,
    managerRole: undefined
  });
});

test("single-user validation enforces role-specific fields", () => {
  const errors = validateSingleUser(
    { Name: "", Email: "", Role: "Area Manager", Region: "", "Reporting Manager Email": "" },
    definitions
  );
  assert.deepEqual(Object.keys(errors).sort(), ["Email", "Name", "Region", "Reporting Manager Email"].sort());
});

test("single-user payload normalizes fields not used by the selected role", () => {
  assert.deepEqual(
    buildSingleUserPayload(
      {
        Name: "A",
        Email: "a@example.com",
        Role: "Admin",
        Region: "North",
        "Reporting Manager Email": "boss@example.com"
      },
      definitions
    ),
    { Name: "A", Email: "a@example.com", Role: "Admin", Region: "All", "Reporting Manager Email": "", Status: "active" }
  );
});
