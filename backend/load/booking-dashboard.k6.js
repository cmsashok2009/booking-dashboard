import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    booking_dashboard_read_smoke: {
      executor: "constant-vus",
      vus: Number(__ENV.K6_VUS || 3),
      duration: __ENV.K6_DURATION || "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750", "p(99)<1500"],
    checks: ["rate>0.99"],
  },
};

const baseUrl = (__ENV.BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const email = __ENV.K6_EMAIL || "admin@example.com";
const password = __ENV.K6_PASSWORD || "Password@123";

export function setup() {
  const login = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { "content-type": "application/json" } },
  );
  check(login, { "login succeeds": (response) => response.status === 200 });
  return { cookie: login.cookies.booking_session?.[0]?.value || "" };
}

export default function (data) {
  const cookieHeader = data.cookie
    ? { Cookie: `booking_session=${data.cookie}` }
    : {};
  const health = http.get(`${baseUrl}/api/health`);
  check(health, { "health ok": (response) => response.status === 200 });

  const session = http.get(`${baseUrl}/api/auth/session`, {
    headers: cookieHeader,
  });
  check(session, { "session ok": (response) => response.status === 200 });

  const bookings = http.get(`${baseUrl}/api/bookings?page=1&pageSize=25`, {
    headers: cookieHeader,
  });
  check(bookings, {
    "bookings ok": (response) => response.status === 200,
    "bookings paginated": (response) =>
      Boolean(response.json("pagination.pageSize")),
  });

  sleep(Number(__ENV.K6_PAUSE_SECONDS || 0.1));
}
