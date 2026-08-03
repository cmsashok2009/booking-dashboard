import assert from "node:assert/strict";
import test from "node:test";
import {
  API_ACCESS,
  API_ACCESS_POLICIES,
  apiAccessPolicy,
  authorizeApiRequest,
} from "../src/api-access-policy.js";

const admin = { id: "admin-1", role: "Admin" };
const areaManager = { id: "area-1", role: "Area Manager" };

test("API access policy is fail-closed and method-specific", () => {
  assert.equal(apiAccessPolicy("GET", "/api/not-declared"), null);
  assert.equal(apiAccessPolicy("PUT", "/api/admin/users"), null);
  assert.equal(
    authorizeApiRequest({ method: "GET", pathname: "/api/not-declared" }).code,
    "ROUTE_NOT_FOUND",
  );
});

test("public, authenticated, and admin policies enforce their boundary", () => {
  assert.equal(
    authorizeApiRequest({ method: "GET", pathname: "/api/health" }).allowed,
    true,
  );
  assert.equal(
    authorizeApiRequest({ method: "GET", pathname: "/api/bookings" }).status,
    401,
  );
  assert.equal(
    authorizeApiRequest({
      method: "GET",
      pathname: "/api/bookings",
      user: areaManager,
    }).allowed,
    true,
  );
  assert.equal(
    authorizeApiRequest({
      method: "POST",
      pathname: "/api/admin/users",
      user: areaManager,
    }).status,
    403,
  );
  assert.equal(
    authorizeApiRequest({
      method: "POST",
      pathname: "/api/admin/users",
      user: admin,
    }).allowed,
    true,
  );
});

test("all protected policy entries reject insufficient identity", () => {
  for (const policy of API_ACCESS_POLICIES) {
    if (policy.access === API_ACCESS.PUBLIC) continue;
    const pathname = policy.path
      .replace(":id", "example-id")
      .replace(":path", "users");
    const unauthenticated = authorizeApiRequest({
      method: policy.method,
      pathname,
    });
    const expectedStatus =
      [API_ACCESS.ADMIN, API_ACCESS.ROLE_SCOPED].includes(policy.access)
        ? 403
        : 401;
    assert.equal(
      unauthenticated.status,
      expectedStatus,
      `${policy.method} ${policy.path}`,
    );
    if (policy.access === API_ACCESS.ADMIN) {
      const nonAdmin = authorizeApiRequest({
        method: policy.method,
        pathname,
        user: areaManager,
      });
      assert.equal(nonAdmin.status, 403, `${policy.method} ${policy.path}`);
    }
  }
});

test("the OAuth callback exception is exact", () => {
  assert.equal(
    apiAccessPolicy("GET", "/api/admin/email-provider/google/callback").access,
    API_ACCESS.PUBLIC,
  );
  assert.equal(
    apiAccessPolicy("GET", "/api/admin/email-provider/google/test").access,
    API_ACCESS.ADMIN,
  );
  assert.equal(
    apiAccessPolicy("POST", "/api/admin/email-provider/google/callback").access,
    API_ACCESS.ADMIN,
  );
});