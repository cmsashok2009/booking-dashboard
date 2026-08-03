export const API_ACCESS = Object.freeze({
  PUBLIC: "public",
  AUTHENTICATED: "authenticated",
  ADMIN: "admin",
});

const exact = (method, pathname, access) => ({
  method,
  path: pathname,
  access,
  matches: (candidate) => candidate === pathname,
});

const pattern = (method, routePath, expression, access) => ({
  method,
  path: routePath,
  access,
  matches: (candidate) => expression.test(candidate),
});

export const API_ACCESS_POLICIES = Object.freeze([
  exact("GET", "/api/health", API_ACCESS.PUBLIC),
  exact("GET", "/api/ready", API_ACCESS.PUBLIC),
  exact("POST", "/api/auth/login", API_ACCESS.PUBLIC),
  exact("GET", "/api/auth/session", API_ACCESS.AUTHENTICATED),
  exact("POST", "/api/auth/logout", API_ACCESS.PUBLIC),
  exact("POST", "/api/auth/password/forgot", API_ACCESS.PUBLIC),
  exact("POST", "/api/auth/password/reset/validate", API_ACCESS.PUBLIC),
  exact("POST", "/api/auth/password/reset", API_ACCESS.PUBLIC),
  exact("POST", "/api/auth/password/change", API_ACCESS.AUTHENTICATED),
  exact("PATCH", "/api/profile", API_ACCESS.AUTHENTICATED),
  exact("GET", "/api/metrics", API_ACCESS.ADMIN),
  exact("GET", "/api/bootstrap", API_ACCESS.AUTHENTICATED),
  exact("GET", "/api/bookings", API_ACCESS.AUTHENTICATED),
  pattern("GET", "/api/bookings/:id", /^\/api\/bookings\/[^/]+$/, API_ACCESS.AUTHENTICATED),
  pattern("PATCH", "/api/bookings/:id/area-inputs", /^\/api\/bookings\/[^/]+\/area-inputs$/, API_ACCESS.ROLE_SCOPED),
  pattern("PATCH", "/api/bookings/:id/regional-inputs", /^\/api\/bookings\/[^/]+\/regional-inputs$/, API_ACCESS.ROLE_SCOPED),
  exact("GET", "/api/notifications", API_ACCESS.AUTHENTICATED),
  exact("GET", "/api/notifications/stream", API_ACCESS.AUTHENTICATED),
  pattern("PATCH", "/api/notifications/:id/read", /^\/api\/notifications\/[^/]+\/read$/, API_ACCESS.AUTHENTICATED),
  exact("POST", "/api/auth/activation/validate", API_ACCESS.PUBLIC),
  exact("POST", "/api/auth/activation/complete", API_ACCESS.PUBLIC),
  exact("GET", "/api/admin/email-provider/google/callback", API_ACCESS.PUBLIC),
  pattern("GET", "/api/admin/:path", /^\/api\/admin(?:\/.*)?$/, API_ACCESS.ADMIN),
  pattern("POST", "/api/admin/:path", /^\/api\/admin(?:\/.*)?$/, API_ACCESS.ADMIN),
  pattern("PATCH", "/api/admin/:path", /^\/api\/admin(?:\/.*)?$/, API_ACCESS.ADMIN),
  pattern("DELETE", "/api/admin/:path", /^\/api\/admin(?:\/.*)?$/, API_ACCESS.ADMIN),
]);

export function apiAccessPolicy(method, pathname) {
  return API_ACCESS_POLICIES.find(
    (policy) => policy.method === method && policy.matches(pathname),
  ) || null;
}

export function authorizeApiRequest({ method, pathname, user }) {
  const policy = apiAccessPolicy(method, pathname);
  if (!policy) {
    return {
      allowed: false,
      status: 404,
      code: "ROUTE_NOT_FOUND",
      error: "API route not found.",
    };
  }
  if (policy.access === API_ACCESS.PUBLIC) return { allowed: true, policy };
  if (!user && [API_ACCESS.ADMIN, API_ACCESS.ROLE_SCOPED].includes(policy.access)) {
    return {
      allowed: false,
      status: 403,
      code: "ADMIN_REQUIRED",
      error: "Admin access is required.",
      policy,
    };
  }
  if (!user) {
    return {
      allowed: false,
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      error: "Authentication is required.",
      policy,
    };
  }
  if (policy.access === API_ACCESS.ADMIN && user.role !== "Admin") {
    return {
      allowed: false,
      status: 403,
      code: "ADMIN_REQUIRED",
      error: "Admin access is required.",
      policy,
    };
  }
  return { allowed: true, policy };
}