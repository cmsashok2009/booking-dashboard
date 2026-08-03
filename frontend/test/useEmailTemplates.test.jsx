import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../app/utils/api", () => ({ request }));
import useEmailTemplates from "../app/hooks/useEmailTemplates";

const user = { id: "u-admin", role: "Admin" };
const management = {
  samples: [{ id: "s1" }],
  templates: [{ id: "t1", status: "draft" }],
  pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNextPage: false },
  summary: { total: 1, active: 0, draft: 1 }
};
const activePage = (page, hasNextPage) => ({
  samples: [],
  templates: [{ id: `active-${page}`, status: "active" }],
  pagination: { page, pageSize: 100, total: 2, totalPages: 2, hasNextPage },
  summary: { total: 2, active: 2, draft: 0 }
});

beforeEach(() => request.mockReset());

describe("email templates collection hook", () => {
  it("loads bounded management and all active onboarding pages", async () => {
    request.mockImplementation((url) => {
      const parsed = new URL(url, "http://localhost");
      if (parsed.searchParams.get("pageSize") === "100") {
        return Promise.resolve(
          activePage(Number(parsed.searchParams.get("page")), parsed.searchParams.get("page") === "1")
        );
      }
      return Promise.resolve(management);
    });
    const { result } = renderHook(() => useEmailTemplates(user, true));
    await waitFor(() => expect(result.current.templates).toEqual([{ id: "t1", status: "draft" }]));
    await waitFor(() => expect(result.current.activeTemplates).toHaveLength(2));
    expect(result.current.activeTemplates.map((item) => item.id)).toEqual(["active-1", "active-2"]);
    expect(request.mock.calls.some(([url]) => url.includes("pageSize=10"))).toBe(true);
    expect(request.mock.calls.some(([url]) => url.includes("page=2") && url.includes("pageSize=100"))).toBe(true);
  });

  it("debounces server filters from page one", async () => {
    vi.useFakeTimers();
    request.mockResolvedValue(management);
    const { result } = renderHook(() => useEmailTemplates(user, true));
    await act(async () => vi.runAllTimersAsync());
    await act(async () => result.current.updateFilters({ search: "welcome", status: "active" }));
    await act(async () => vi.advanceTimersByTimeAsync(250));
    const parsed = new URL(request.mock.calls.at(-1)[0], "http://localhost");
    expect(parsed.searchParams.get("search")).toBe("welcome");
    expect(parsed.searchParams.get("status")).toBe("active");
    expect(parsed.searchParams.get("page")).toBe("1");
    vi.useRealTimers();
  });

  it("preserves seeded active options and exposes recoverable errors", async () => {
    request
      .mockRejectedValueOnce(new Error("Dependency unavailable"))
      .mockRejectedValueOnce(new Error("Dependency unavailable"));
    const seed = [{ id: "seed", status: "active" }];
    const { result } = renderHook(() => useEmailTemplates(user, true, seed));
    await waitFor(() => expect(result.current.error).toBe("Dependency unavailable"));
    expect(result.current.activeTemplates).toEqual(seed);
    expect(result.current.activeError).toBe("Dependency unavailable");

    request.mockResolvedValueOnce(management).mockResolvedValueOnce(activePage(1, false));
    await act(async () => result.current.reloadAll());
    expect(result.current.error).toBe("");
    expect(result.current.activeTemplates).toHaveLength(1);
  });
});
