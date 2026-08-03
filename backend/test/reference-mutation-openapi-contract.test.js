import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("OpenAPI documents bounded reference mutation responses", async () => {
  const spec = JSON.parse(
    await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
  );
  const schema = spec.components.schemas.ReferenceMutationResponse;
  assert.deepEqual(Object.keys(schema.properties).sort(), [
    "collectionUrl",
    "dealerCode",
    "fieldCode",
    "option",
    "region",
    "updatedCount",
  ]);
  assert.equal("lookups" in schema.properties, false);
  assert.equal("lookupOptions" in schema.properties, false);
  assert.equal(
    "updatedBy" in spec.components.schemas.AddLookupOptionRequest.properties,
    false,
  );
  assert.equal(
    "updatedBy" in spec.components.schemas.UpdateLookupOptionRequest.properties,
    false,
  );

  for (const [path, method, status] of [
    ["/api/admin/regions", "post", "201"],
    ["/api/admin/dealer-codes", "post", "201"],
    ["/api/admin/regions/{regionId}", "patch", "200"],
    ["/api/admin/dealer-codes/{dealerCodeId}", "patch", "200"],
  ]) {
    assert.deepEqual(
      spec.paths[path][method].responses[status].content["application/json"]
        .schema,
      {
        $ref: "#/components/schemas/ReferenceMutationResponse",
      },
    );
  }

  const malformedReferences = [];
  function inspect(value, location = "spec") {
    if (!value || typeof value !== "object") return;
    if (Object.hasOwn(value, "")) malformedReferences.push(location);
    for (const [key, child] of Object.entries(value))
      inspect(child, `${location}.${key}`);
  }
  inspect(spec);
  assert.deepEqual(malformedReferences, []);
});
