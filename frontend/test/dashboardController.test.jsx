import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("../app/utils/api", () => ({ request }));
import useDashboardController from "../app/hooks/useDashboardController";

beforeEach(() => {
  vi.clearAllMocks();
  request.mockReset();
  window.sessionStorage.clear();
});

describe("dashboard controller session lifecycle", () => {
  it("resolves to login when no cached session exists", async () => {
    const { result } = renderHook(() => useDashboardController());
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    expect(result.current.user).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it("restores a cached user with bootstrap and scoped bookings", async () => {
    const user = { id: "u1", name: "Admin", role: "Admin" };
    window.sessionStorage.setItem("booking-dashboard-user", JSON.stringify(user));
    request.mockImplementation((url) => {
      if (url === "/api/bootstrap")
        return Promise.resolve({ currentUser: user, users: [], roles: [], regions: [], lookups: {} });
      if (url.startsWith("/api/bookings?")) return Promise.resolve({ rows: [] });
      if (url === "/api/notifications") return Promise.resolve({ notifications: [] });
      if (url.startsWith("/api/admin/users?")) {
        return Promise.resolve({
          users: [],
          pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1, hasNextPage: false }
        });
      }
      throw new Error("Unexpected request");
    });
    const { result } = renderHook(() => useDashboardController());
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    expect(result.current.user).toEqual(user);
    expect(result.current.shellState.user).toEqual(user);
    expect(request).toHaveBeenCalledWith(expect.stringContaining("role=Admin"));
    expect(request).toHaveBeenCalledWith(expect.stringContaining("userId=u1"));
  });

  it("reports restoration failures and removes malformed cached users", async () => {
    window.sessionStorage.setItem("booking-dashboard-user", "{bad");
    const failed = renderHook(() => useDashboardController());
    await waitFor(() => expect(failed.result.current.sessionReady).toBe(true));
    expect(failed.result.current.sessionError).toBeTruthy();
    failed.unmount();

    window.sessionStorage.setItem("booking-dashboard-user", JSON.stringify({ name: "Missing identity" }));
    const invalid = renderHook(() => useDashboardController());
    await waitFor(() => expect(invalid.result.current.sessionReady).toBe(true));
    expect(invalid.result.current.user).toBeNull();
    expect(window.sessionStorage.getItem("booking-dashboard-user")).toBeNull();
  });
});
