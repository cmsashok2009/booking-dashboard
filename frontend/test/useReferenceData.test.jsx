import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../app/utils/api", () => ({ request }));
import useReferenceData, { mergeReferenceData } from "../app/hooks/useReferenceData";

const seed = {
  lookupOptions: { bookingCategory: [{ id: "seed", label: "Seed", status: "active" }] }
};

beforeEach(() => request.mockReset());

describe("reference data traversal", () => {
  it("reconstructs the existing bootstrap shape from safe projections", () => {
    const data = mergeReferenceData(seed, {
      roles: [{ code: "AM", name: "Area Manager", status: "active" }],
      regions: [{ id: "r1", name: "West", status: "active" }],
      dealerCodes: [{ id: "d1", code: "DLR1", status: "active" }],
      dealerAssignments: [{ id: "DLR1", dealerCode: "DLR1" }],
      lookupOptions: { bookingCategory: [{ id: "o1", label: "Priority", status: "active" }] }
    });
    expect(data.roles).toEqual(["Area Manager"]);
    expect(data.regions).toEqual(["West"]);
    expect(data.lookups.bookingCategory).toEqual(["Priority"]);
  });

  it("traverses every bounded page without identity query parameters", async () => {
    request.mockImplementation((url) => {
      const parsed = new URL(url, "http://localhost");
      const collection = parsed.searchParams.get("collection");
      const page = Number(parsed.searchParams.get("page"));
      const item =
        collection === "regions"
          ? { id: `r${page}`, name: `Region ${page}`, status: "active" }
          : {
              id: `${collection}-${page}`,
              label: `${collection} ${page}`,
              status: "active",
              name: `${collection} ${page}`
            };
      return Promise.resolve({
        items: [item],
        pagination: { page, hasNextPage: collection === "regions" && page === 1 }
      });
    });
    const { result } = renderHook(() => useReferenceData({ role: "Admin" }, true, seed));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.data?.regions).toEqual(["Region 1", "Region 2"]));
    expect(request.mock.calls.every(([url]) => !new URL(url, "http://localhost").searchParams.has("userId"))).toBe(
      true
    );
    expect(
      request.mock.calls.every(([url]) => new URL(url, "http://localhost").searchParams.get("pageSize") === "100")
    ).toBe(true);
  });

  it("does not request Admin reference data for non-Admin roles", () => {
    renderHook(() => useReferenceData({ role: "Area Manager" }, true, seed));
    expect(request).not.toHaveBeenCalled();
  });
});
