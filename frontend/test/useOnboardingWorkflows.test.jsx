import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../app/utils/api", () => ({ request }));
import useOnboardingWorkflows from "../app/hooks/useOnboardingWorkflows";

const user = { id: "admin-1", role: "Admin" };

function page(number, workflows, total, hasNextPage) {
  return {
    workflows,
    pagination: {
      page: number,
      pageSize: 20,
      total,
      totalPages: Math.max(1, Math.ceil(total / 20)),
      hasNextPage
    }
  };
}

beforeEach(() => request.mockReset());

describe("onboarding workflow collection hook", () => {
  it("loads bounded owner pages and merges load-more results without duplicates", async () => {
    request.mockImplementation((url) => {
      const parsed = new URL(url, "http://localhost");
      const pageNumber = Number(parsed.searchParams.get("page"));
      return Promise.resolve(
        page(
          pageNumber,
          pageNumber === 1 ? [{ id: "w2" }, { id: "w1" }] : [{ id: "w1" }, { id: "w0" }],
          3,
          pageNumber === 1
        )
      );
    });
    const { result } = renderHook(() => useOnboardingWorkflows(user, true));
    await waitFor(() => expect(result.current.workflows.map((item) => item.id)).toEqual(["w2", "w1"]));
    const firstUrl = new URL(request.mock.calls[0][0], "http://localhost");
    expect(firstUrl.searchParams.get("pageSize")).toBe("20");
    expect(firstUrl.searchParams.get("userId")).toBeNull();

    await act(async () => result.current.loadMore());
    expect(result.current.workflows.map((item) => item.id)).toEqual(["w2", "w1", "w0"]);
    expect(result.current.pagination.hasNextPage).toBe(false);
  });

  it("retains seed data through failure and recovers on retry", async () => {
    request.mockRejectedValueOnce(new Error("Workflow service unavailable"));
    const { result } = renderHook(() => useOnboardingWorkflows(user, true, [{ id: "seed" }]));
    await waitFor(() => expect(result.current.error).toBe("Workflow service unavailable"));
    expect(result.current.workflows).toEqual([{ id: "seed" }]);

    request.mockResolvedValueOnce(page(1, [{ id: "fresh" }], 1, false));
    await act(async () => result.current.reload());
    expect(result.current.error).toBe("");
    expect(result.current.workflows).toEqual([{ id: "fresh" }]);
  });

  it("does not request workflows for non-Admin users", () => {
    renderHook(() => useOnboardingWorkflows({ role: "Area Manager" }, true));
    expect(request).not.toHaveBeenCalled();
  });
});
