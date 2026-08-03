import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../app/utils/api", () => ({ request }));
import useAdminUsers from "../app/hooks/useAdminUsers";

const user = { id: "u-admin", role: "Admin" };
const filters = { search: "", role: "", status: "", region: "", sortKey: "name", sortDir: "asc" };

beforeEach(() => request.mockReset());

describe("Admin users collection hook", () => {
  it("loads a bounded page with server totals and filtered query values", async () => {
    request.mockResolvedValue({
      users: [{ id: "u1", name: "Admin" }],
      pagination: { page: 2, pageSize: 10, total: 21, totalPages: 3, hasNextPage: true }
    });
    const setPage = vi.fn();
    const { result } = renderHook(() => useAdminUsers(user, { ...filters, role: "Admin" }, 2, setPage));

    await waitFor(() => expect(result.current.users).toHaveLength(1));
    expect(result.current.users).toEqual([{ id: "u1", name: "Admin" }]);
    expect(result.current.pagination.total).toBe(21);
    const requested = new URL(request.mock.calls[0][0], "http://localhost");
    expect(requested.pathname).toBe("/api/admin/users");
    expect(requested.searchParams.get("page")).toBe("2");
    expect(requested.searchParams.get("pageSize")).toBe("10");
    expect(requested.searchParams.get("role")).toBe("Admin");
    expect(request.mock.calls[0][1]).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("exports all filtered users through bounded 100-row pages", async () => {
    request
      .mockResolvedValueOnce({
        users: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1, hasNextPage: false }
      })
      .mockResolvedValueOnce({
        users: [{ id: "u1" }],
        pagination: { page: 1, pageSize: 100, total: 2, totalPages: 2, hasNextPage: true }
      })
      .mockResolvedValueOnce({
        users: [{ id: "u2" }],
        pagination: { page: 2, pageSize: 100, total: 2, totalPages: 2, hasNextPage: false }
      });
    const setPage = vi.fn();
    const { result } = renderHook(() => useAdminUsers(user, filters, 1, setPage));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let exported;
    await act(async () => {
      exported = await result.current.loadAll();
    });
    expect(exported.map((item) => item.id)).toEqual(["u1", "u2"]);
    expect(request.mock.calls[1][0]).toContain("pageSize=100");
    expect(request.mock.calls[2][0]).toContain("page=2");
  });

  it("exposes a recoverable error and reloads the current page", async () => {
    request.mockRejectedValueOnce(new Error("Dependency unavailable"));
    const setPage = vi.fn();
    const { result } = renderHook(() => useAdminUsers(user, filters, 1, setPage));
    await waitFor(() => expect(result.current.error).toBe("Dependency unavailable"));

    request.mockResolvedValueOnce({
      users: [{ id: "u1" }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNextPage: false }
    });
    await act(async () => result.current.reload());
    expect(result.current.error).toBe("");
    expect(result.current.users).toEqual([{ id: "u1" }]);
  });
});
