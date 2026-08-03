import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../app/utils/api", () => ({ request }));
import useEmailCampaigns from "../app/hooks/useEmailCampaigns";

const user = { id: "u-admin", role: "Admin" };
const payload = {
  campaigns: [{ id: "c1", status: "completed" }],
  pagination: { page: 1, pageSize: 5, total: 8, totalPages: 2, hasNextPage: true },
  summary: { campaigns: 12, sent: 10, failed: 2 }
};

beforeEach(() => request.mockReset());

describe("email campaigns collection hook", () => {
  it("loads a bounded active page with server totals", async () => {
    request.mockResolvedValue(payload);
    const { result } = renderHook(() => useEmailCampaigns(user, true));
    await waitFor(() => expect(result.current.campaigns).toHaveLength(1));
    expect(result.current.pagination.total).toBe(8);
    expect(result.current.summary).toEqual({ campaigns: 12, sent: 10, failed: 2 });
    const requested = new URL(request.mock.calls[0][0], "http://localhost");
    expect(requested.pathname).toBe("/api/admin/email-campaigns");
    expect(requested.searchParams.get("pageSize")).toBe("5");
    expect(requested.searchParams.get("sortDir")).toBe("desc");
    expect(request.mock.calls[0][1]).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("does not request campaigns until the Admin opens the view", async () => {
    const { rerender } = renderHook(({ enabled }) => useEmailCampaigns(user, enabled), {
      initialProps: { enabled: false }
    });
    await act(async () => Promise.resolve());
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValue(payload);
    rerender({ enabled: true });
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
  });

  it("applies server filters from page one and recovers after an error", async () => {
    request.mockResolvedValueOnce(payload);
    const { result } = renderHook(() => useEmailCampaigns(user, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    request.mockRejectedValueOnce(new Error("Dependency unavailable"));
    await act(async () => result.current.updateFilters({ status: "failed" }));
    await waitFor(() => expect(result.current.error).toBe("Dependency unavailable"));
    expect(new URL(request.mock.calls.at(-1)[0], "http://localhost").searchParams.get("status")).toBe("failed");

    request.mockResolvedValueOnce({ ...payload, campaigns: [] });
    await act(async () => result.current.reload());
    expect(result.current.error).toBe("");
  });
});
