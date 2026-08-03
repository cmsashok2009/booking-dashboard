import assert from "node:assert/strict";
import test from "node:test";
import { validateCycloneDxSbom } from "../scripts/generate-sbom.mjs";

function validSbom() {
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    metadata: { component: { name: "backend" } },
    components: [{ name: "mysql2", version: "3.23.2" }],
    dependencies: [{ ref: "backend@0.1.0", dependsOn: ["mysql2@3.23.2"] }],
  };
}

test("SBOM validation accepts a populated CycloneDX dependency graph", () => {
  assert.deepEqual(validateCycloneDxSbom(validSbom(), "backend"), {
    name: "backend",
    format: "CycloneDX",
    specVersion: "1.5",
    componentCount: 1,
    dependencyCount: 1,
  });
});

test("SBOM validation rejects wrong components and empty artifacts", () => {
  assert.throws(
    () => validateCycloneDxSbom(validSbom(), "frontend"),
    /component mismatch/,
  );
  assert.throws(
    () =>
      validateCycloneDxSbom(
        { ...validSbom(), components: [] },
        "backend",
      ),
    /contains no components/,
  );
  assert.throws(
    () =>
      validateCycloneDxSbom(
        { ...validSbom(), dependencies: undefined },
        "backend",
      ),
    /contains no dependency graph/,
  );
});