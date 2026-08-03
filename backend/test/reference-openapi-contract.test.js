import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("OpenAPI documents safe bounded reference-data traversal", async () => {
  const spec = JSON.parse(await readFile(new URL("../openapi.json", import.meta.url), "utf8"));
  const operation = spec.paths["/api/admin/reference-data"].get;
  const parameters = Object.fromEntries(
    operation.parameters.map((parameter) => [parameter.name, parameter])
  );

  assert.deepEqual(parameters.collection.schema.enum, [
    "regions",
    "dealerCodes",
    "dealerAssignments",
    "roles",
    "lookupOptions"
  ]);
  assert.equal(parameters.collection.required, true);
  assert.equal(parameters.page.schema.minimum, 1);
  assert.equal(parameters.pageSize.schema.maximum, 100);
  assert.equal(parameters.search.schema.maxLength, 200);
  assert.deepEqual(parameters.sortKey.schema.enum, ["label", "status", "updatedAt", "hierarchyLevel"]);
  assert.equal("userId" in parameters, false);
  assert.equal("actorId" in parameters, false);
  assert.deepEqual(operation.responses["200"].content["application/json"].schema, {
    $ref: "#/components/schemas/ReferenceDataListResponse"
  });
  assert.equal(spec.components.schemas.ReferenceDataListResponse.properties.items.maxItems, 100);

  const bootstrap = spec.components.schemas.BootstrapResponse.properties;
  for (const name of ["roles", "regions", "regionOptions", "dealerCodes", "dealerAssignments", "roleDefinitions"]) {
    assert.equal(bootstrap[name].maxItems, 100, `${name} must be capped`);
  }
  assert.equal(bootstrap.lookupOptions.additionalProperties.maxItems, 100);
  assert.equal(bootstrap.collectionLinks.properties.referenceData.example, "/api/admin/reference-data");
  assert.ok(bootstrap.referenceDataPagination);
});
