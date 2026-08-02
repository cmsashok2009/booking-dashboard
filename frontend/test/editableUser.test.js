import assert from "node:assert/strict";
import { test } from "vitest";

import { editableUserValues, validateEditableUser } from "../app/features/users/editableUser.js";

test("editable user values normalize absent fields", () => {
  assert.deepEqual(editableUserValues({ name: "A" }), { name: "A", email: "", role: "", region: "", status: "" });
});

test("editable user validation rejects missing and malformed fields", () => {
  assert.deepEqual(
    Object.keys(validateEditableUser({ name: "", email: "bad", role: "", region: "", status: "" })).sort(),
    ["email", "name", "region", "role", "status"].sort()
  );
  assert.deepEqual(
    validateEditableUser({ name: "A", email: "a@example.com", role: "Dealer", region: "North", status: "active" }),
    {}
  );
});
