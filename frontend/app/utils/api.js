export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

function buildHeaders(options) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  return {
    ...(options.body && !isFormData ? { "content-type": "application/json" } : {}),
    ...(options.headers || {})
  };
}

function parsePayload(text, contentType) {
  if (!contentType.includes("application/json")) return text;
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function emitRequestEvent(name, detail) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
}

function createRequestError(path, status, payload, fallback, requestId) {
  const error = new Error(payload?.error || payload?.message || fallback || "The request could not be completed.");
  error.name = "ApiRequestError";
  error.status = status;
  error.path = path;
  error.payload = payload;
  error.requestId = requestId;
  error.recoverable = status === 0 || status === 408 || status === 429 || status >= 500;
  return error;
}

function notifyExpiredSession(path, status, payload) {
  if (typeof window === "undefined" || ["/api/auth/login", "/api/auth/session"].includes(path)) return;
  const adminSessionMissing = status === 403 && /admin access is required/i.test(String(payload?.error || ""));
  if (status === 401 || adminSessionMissing)
    window.dispatchEvent(
      new CustomEvent("booking-session-expired", { detail: { message: "Your session has expired. Sign in again." } })
    );
}

function xhrRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || "GET", path, true);
    xhr.timeout = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    Object.entries(buildHeaders(options)).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.onload = () => {
      const contentType = xhr.getResponseHeader("content-type") || "";
      const payload = parsePayload(xhr.responseText || "", contentType);
      if (xhr.status < 200 || xhr.status >= 300) {
        notifyExpiredSession(path, xhr.status, payload);
        reject(createRequestError(path, xhr.status, payload, xhr.statusText, options.requestId));
        return;
      }
      resolve(payload);
    };
    xhr.onerror = () =>
      reject(
        createRequestError(
          path,
          0,
          null,
          "Network connection failed. Check your connection and try again.",
          options.requestId
        )
      );
    xhr.ontimeout = () =>
      reject(createRequestError(path, 408, null, "The request timed out. Try again.", options.requestId));
    xhr.send(options.body || null);
  });
}

export async function request(path, options = {}) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  emitRequestEvent("booking-api-start", { requestId, path });
  try {
    const headers = { "x-request-id": requestId, ...buildHeaders(options) };
    if (typeof fetch !== "function") return await xhrRequest(path, { ...options, headers, requestId });
    let response;
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const timeoutId = globalThis.setTimeout(() => controller.abort("timeout"), timeoutMs);
    const abortFromCaller = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });
    try {
      const fetchOptions = { ...options };
      delete fetchOptions.timeoutMs;
      delete fetchOptions.signal;
      response = await fetch(path, { ...fetchOptions, headers, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted && !options.signal?.aborted) {
        throw createRequestError(path, 408, null, "The request timed out. Try again.", requestId);
      }
      if (options.signal?.aborted) throw error;
      throw createRequestError(
        path,
        0,
        null,
        "Network connection failed. Check your connection and try again.",
        requestId
      );
    } finally {
      globalThis.clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
    const contentType = response.headers.get("content-type") || "";
    const payload = parsePayload(await response.text(), contentType);
    if (!response.ok) {
      notifyExpiredSession(path, response.status, payload);
      throw createRequestError(path, response.status, payload, response.statusText, requestId);
    }
    return payload;
  } catch (error) {
    if (error && !error.requestId) error.requestId = requestId;
    emitRequestEvent("booking-api-error", {
      requestId,
      path,
      status: Number(error?.status || 0),
      recoverable: Boolean(error?.recoverable)
    });
    throw error;
  } finally {
    emitRequestEvent("booking-api-end", { requestId, path });
  }
}

export async function requestText(path, options = {}) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  emitRequestEvent("booking-api-start", { requestId, path });
  try {
    let response;
    try {
      response = await fetch(path, { ...options, headers: { "x-request-id": requestId, ...(options.headers || {}) } });
    } catch {
      throw createRequestError(
        path,
        0,
        null,
        "Network connection failed. Check your connection and try again.",
        requestId
      );
    }
    if (!response.ok) throw createRequestError(path, response.status, null, response.statusText, requestId);
    return response.text();
  } catch (error) {
    emitRequestEvent("booking-api-error", {
      requestId,
      path,
      status: Number(error?.status || 0),
      recoverable: Boolean(error?.recoverable)
    });
    throw error;
  } finally {
    emitRequestEvent("booking-api-end", { requestId, path });
  }
}
