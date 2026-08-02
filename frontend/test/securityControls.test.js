import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config.mjs";
import { POST as importBookings } from "../app/api/ui/bookings/import/route";

afterEach(() => {
  vi.restoreAllMocks();
});

function uploadRequest(file) {
  const fields = new Map([["bookingFile", file]]);
  return {
    formData: async () => ({ get: (name) => fields.get(name) ?? null }),
    headers: new Headers()
  };
}

describe("frontend security controls", () => {
  it("ships defensive response headers without unsafe-eval outside development", async () => {
    const [{ headers }] = await nextConfig.headers();
    const values = Object.fromEntries(headers.map(({ key, value }) => [key.toLowerCase(), value]));

    expect(values["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(values["content-security-policy"]).toContain("object-src 'none'");
    expect(values["content-security-policy"]).not.toContain("'unsafe-eval'");
    expect(values["x-content-type-options"]).toBe("nosniff");
    expect(values["x-frame-options"]).toBe("DENY");
  });

  it("rejects booking uploads that are not CSV files before forwarding", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await importBookings(uploadRequest({ name: "bookings.xlsx", size: 4, text: async () => "data" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Use a .csv booking-upload file." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects booking uploads larger than 5 MB before forwarding", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const file = { name: "bookings.csv", size: 5 * 1024 * 1024 + 1, text: async () => "" };
    const response = await importBookings(uploadRequest(file));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "The upload must be 5 MB or smaller." });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
