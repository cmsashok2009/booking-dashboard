export function percentile(values, percentileRank) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}

export function summarizeSamples(samples) {
  const durations = samples.map((sample) => sample.durationMs);
  const failures = samples.filter(
    (sample) => sample.status >= 400 || sample.error,
  );
  const byRoute = {};
  for (const sample of samples) {
    const current = byRoute[sample.route] || {
      count: 0,
      failures: 0,
      durations: [],
    };
    current.count += 1;
    if (sample.status >= 400 || sample.error) current.failures += 1;
    current.durations.push(sample.durationMs);
    byRoute[sample.route] = current;
  }
  return {
    requestCount: samples.length,
    failureCount: failures.length,
    errorRate: samples.length ? failures.length / samples.length : 1,
    latencyMs: {
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      max: durations.length ? Math.max(...durations) : 0,
    },
    byRoute: Object.fromEntries(
      Object.entries(byRoute).map(([route, value]) => [
        route,
        {
          count: value.count,
          failures: value.failures,
          p95: percentile(value.durations, 95),
        },
      ]),
    ),
  };
}

export function evaluateThresholds(summary, thresholds) {
  const failures = [];
  if (summary.requestCount < thresholds.minRequests) {
    failures.push(
      `requestCount ${summary.requestCount} below ${thresholds.minRequests}`,
    );
  }
  if (summary.errorRate > thresholds.maxErrorRate) {
    failures.push(
      `errorRate ${summary.errorRate.toFixed(4)} above ${thresholds.maxErrorRate}`,
    );
  }
  if (summary.latencyMs.p95 > thresholds.maxP95Ms) {
    failures.push(
      `p95 ${summary.latencyMs.p95.toFixed(1)}ms above ${thresholds.maxP95Ms}ms`,
    );
  }
  return failures;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cookieFrom(response) {
  return String(response.headers.get("set-cookie") || "").split(";")[0];
}

async function timedRequest(samples, route, url, options = {}) {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, options);
    const durationMs = performance.now() - startedAt;
    samples.push({ route, status: response.status, durationMs });
    return response;
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    samples.push({
      route,
      status: 0,
      durationMs,
      error: error.name || "Error",
    });
    throw error;
  }
}

async function login(samples, baseUrl, email, password) {
  const response = await timedRequest(
    samples,
    "POST /api/auth/login",
    `${baseUrl}/api/auth/login`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
  );
  if (response.status !== 200) {
    throw new Error(`load smoke login failed with HTTP ${response.status}`);
  }
  return cookieFrom(response);
}

async function worker(workerId, config, samples, stopAt, cookie) {
  let writeAttempted = false;
  while (Date.now() < stopAt) {
    await timedRequest(
      samples,
      "GET /api/health",
      `${config.baseUrl}/api/health`,
    );
    await timedRequest(
      samples,
      "GET /api/auth/session",
      `${config.baseUrl}/api/auth/session`,
      {
        headers: { cookie },
      },
    );
    const bookingsResponse = await timedRequest(
      samples,
      "GET /api/bookings",
      `${config.baseUrl}/api/bookings?page=1&pageSize=25`,
      { headers: { cookie } },
    );
    if (
      config.includeWrites &&
      !writeAttempted &&
      bookingsResponse.status === 200
    ) {
      const payload = await bookingsResponse.json();
      const booking =
        payload.rows?.[workerId % Math.max(payload.rows.length, 1)];
      if (booking?.id) {
        await timedRequest(
          samples,
          "PATCH /api/bookings/:id/area-inputs",
          `${config.baseUrl}/api/bookings/${encodeURIComponent(booking.id)}/area-inputs`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({
              bookingCategory: "WANTS PH2 VIN2026",
              wholesalesFeedback: "NOT YET DECIDED",
              wsPlanning: "STOCK AVAILABLE",
              updatedBy: "load-smoke-spoof-attempt",
            }),
          },
        );
        writeAttempted = true;
      }
    }
    await sleep(config.pauseMs);
  }
}

export async function runLoadSmoke(options) {
  const samples = [];
  const config = {
    baseUrl: options.baseUrl.replace(/\/$/, ""),
    email: options.email,
    password: options.password,
    concurrency: options.concurrency,
    durationSeconds: options.durationSeconds,
    pauseMs: options.pauseMs,
    includeWrites: options.includeWrites,
  };
  const startedAt = new Date();
  const stopAt = Date.now() + config.durationSeconds * 1000;
  const cookie = await login(
    samples,
    config.baseUrl,
    config.email,
    config.password,
  );
  await Promise.all(
    Array.from({ length: config.concurrency }, (_, index) =>
      worker(index, config, samples, stopAt, cookie),
    ),
  );
  const summary = summarizeSamples(samples);
  const thresholdFailures = evaluateThresholds(summary, options.thresholds);
  return {
    ok: thresholdFailures.length === 0,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    target: config.baseUrl,
    concurrency: config.concurrency,
    durationSeconds: config.durationSeconds,
    includeWrites: config.includeWrites,
    thresholds: options.thresholds,
    thresholdFailures,
    ...summary,
  };
}
