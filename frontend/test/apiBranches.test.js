import { afterEach, describe, expect, it, vi } from "vitest";
import { request, requestText } from "../app/utils/api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function response(body, status = 200, contentType = "application/json") {
  return new Response(body, {
    status,
    statusText: status === 200 ? "OK" : "Failed",
    headers: { "content-type": contentType }
  });
}

describe("API transport branches", () => {
  it("parses text, empty JSON, and malformed JSON payloads", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response("plain", 200, "text/plain"))
      .mockResolvedValueOnce(response("", 200))
      .mockResolvedValueOnce(response("{bad", 200));
    expect(await request("/text")).toBe("plain");
    expect(await request("/empty")).toBeNull();
    expect(await request("/bad-json")).toBe("{bad");
  });

  it("adds JSON headers but leaves FormData content type to the browser", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => response("{}", 200));
    await request("/json", { method: "POST", body: "{}" });
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ "content-type": "application/json" });
    const form = new FormData();
    form.set("file", "value");
    await request("/form", { method: "POST", body: form, headers: { "x-test": "yes" } });
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ "x-test": "yes", "x-request-id": expect.any(String) });
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty("content-type");
  });

  it("emits session expiry and classifies recoverable server failures", async () => {
    const expired = vi.fn();
    window.addEventListener("booking-session-expired", expired);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(JSON.stringify({ error: "Expired" }), 401))
      .mockResolvedValueOnce(response(JSON.stringify({ error: "Admin access is required" }), 403))
      .mockResolvedValueOnce(response(JSON.stringify({ message: "Unavailable" }), 503));
    await expect(request("/api/private")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 401,
      recoverable: false
    });
    await expect(request("/api/admin")).rejects.toMatchObject({ status: 403 });
    await expect(request("/api/server")).rejects.toMatchObject({
      status: 503,
      recoverable: true,
      message: "Unavailable"
    });
    expect(expired).toHaveBeenCalledTimes(2);
    window.removeEventListener("booking-session-expired", expired);
  });

  it("does not expire sessions for auth endpoints and maps network failures", async () => {
    const expired = vi.fn();
    window.addEventListener("booking-session-expired", expired);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(JSON.stringify({ error: "No" }), 401))
      .mockRejectedValueOnce(new TypeError("offline"));
    await expect(request("/api/auth/login")).rejects.toMatchObject({ status: 401 });
    await expect(request("/offline")).rejects.toMatchObject({ status: 0, recoverable: true });
    expect(expired).not.toHaveBeenCalled();
    window.removeEventListener("booking-session-expired", expired);
  });

  it("preserves caller abort errors", async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_path, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Caller stopped", "AbortError")), {
            once: true
          });
        })
    );
    const pending = request("/cancelled", { signal: controller.signal });
    controller.abort("cancelled");
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("handles text success, status errors, and network errors with lifecycle events", async () => {
    const starts = vi.fn(),
      ends = vi.fn();
    window.addEventListener("booking-api-start", starts);
    window.addEventListener("booking-api-end", ends);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response("hello", 200, "text/plain"))
      .mockResolvedValueOnce(response("", 404, "text/plain"))
      .mockRejectedValueOnce(new Error("offline"));
    expect(await requestText("/file")).toBe("hello");
    await expect(requestText("/missing")).rejects.toMatchObject({ status: 404 });
    await expect(requestText("/offline")).rejects.toMatchObject({ status: 0 });
    expect(starts).toHaveBeenCalledTimes(3);
    expect(ends).toHaveBeenCalledTimes(3);
    window.removeEventListener("booking-api-start", starts);
    window.removeEventListener("booking-api-end", ends);
  });

  it("uses XMLHttpRequest when fetch is unavailable", async () => {
    class FakeXhr {
      open(method, path) {
        this.method = method;
        this.path = path;
      }
      setRequestHeader() {}
      getResponseHeader() {
        return "application/json";
      }
      send() {
        this.status = 200;
        this.responseText = JSON.stringify({ via: "xhr" });
        this.onload();
      }
    }
    vi.stubGlobal("fetch", undefined);
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    await expect(request("/legacy", { timeoutMs: 20 })).resolves.toEqual({ via: "xhr" });
  });
});
