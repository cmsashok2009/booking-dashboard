import assert from "node:assert/strict";
import test from "node:test";
import { assertExportRowLimit } from "../src/routes/booking-routes.js";

test("booking export accepts the documented maximum row count", () => {
  assert.doesNotThrow(() => assertExportRowLimit({ length: 10_000 }));
});

test("booking export rejects rows above the documented maximum", () => {
  assert.throws(
    () => assertExportRowLimit({ length: 10_001 }),
    (error) => error.status === 422 && error.code === "EXPORT_TOO_LARGE",
  );
});
