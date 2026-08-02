import assert from "node:assert/strict";
import { test } from "vitest";

import { filterLookupOptions } from "../app/features/area-fields/options.js";

const options = [
  { label: "Priority", status: "active" },
  { label: "Standard", status: "inactive" }
];

test("lookup option filters combine normalized search and status", () => {
  assert.deepEqual(filterLookupOptions(options, " PRIOR ", "active"), [options[0]]);
  assert.deepEqual(filterLookupOptions(options, "", "inactive"), [options[1]]);
  assert.deepEqual(filterLookupOptions(options, "missing", ""), []);
});
