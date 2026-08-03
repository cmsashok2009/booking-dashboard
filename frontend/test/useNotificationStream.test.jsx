import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../app/utils/api", () => ({ request }));
import useNotificationStream from "../app/hooks/useNotificationStream";

const page = (number, notifications, unreadCount, hasNextPage) => ({
  notifications,
  unreadCount,
  pagination: {
    page: number,
    pageSize: 20,
    total: unreadCount,
    totalPages: Math.max(1, Math.ceil(unreadCount / 20)),
    hasNextPage
  }
});

let streams;

class EventSourceMock {
  constructor(url) {
    this.url = url;
    this.close = vi.fn();
    streams.push(this);
  }

  emit(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

function useHarness(userId = "user-1") {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const collection = useNotificationStream(userId, setNotifications, setUnreadCount);
  return { notifications, unreadCount, ...collection };
}

beforeEach(() => {
  request.mockReset();
  streams = [];
  vi.stubGlobal("EventSource", EventSourceMock);
});

describe("notification collection hook", () => {
  it("loads bounded pages and merges load-more results without duplicates", async () => {
    request.mockImplementation((url) => {
      const parsed = new URL(url, "http://localhost");
      const pageNumber = Number(parsed.searchParams.get("page"));
      return Promise.resolve(
        page(
          pageNumber,
          pageNumber === 1 ? [{ id: "n2" }, { id: "n1" }] : [{ id: "n1" }, { id: "n0" }],
          3,
          pageNumber === 1
        )
      );
    });
    const { result } = renderHook(() => useHarness());
    await waitFor(() => expect(result.current.notifications.map((item) => item.id)).toEqual(["n2", "n1"]));
    expect(result.current.unreadCount).toBe(3);
    const firstUrl = new URL(request.mock.calls[0][0], "http://localhost");
    expect(firstUrl.searchParams.get("pageSize")).toBe("20");
    expect(firstUrl.searchParams.get("userId")).toBeNull();

    await act(async () => result.current.loadMore());
    expect(result.current.notifications.map((item) => item.id)).toEqual(["n2", "n1", "n0"]);
    expect(result.current.pagination.hasNextPage).toBe(false);
  });

  it("applies bounded snapshots and deduplicates streamed notifications", async () => {
    request.mockResolvedValue(page(1, [{ id: "n1" }], 1, false));
    const { result } = renderHook(() => useHarness());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    act(() =>
      streams[0].emit({
        type: "snapshot",
        notifications: [{ id: "n1" }],
        unreadCount: 1,
        pagination: page(1, [], 1, false).pagination
      })
    );
    act(() => streams[0].emit({ type: "notification", notification: { id: "n2" } }));
    act(() => streams[0].emit({ type: "notification", notification: { id: "n2" } }));
    expect(result.current.notifications.map((item) => item.id)).toEqual(["n2", "n1"]);
    expect(result.current.unreadCount).toBe(2);
  });

  it("exposes initial failure and retries without discarding recovered state", async () => {
    request.mockRejectedValueOnce(new Error("Notification service unavailable"));
    const { result } = renderHook(() => useHarness());
    await waitFor(() => expect(result.current.error).toBe("Notification service unavailable"));
    expect(result.current.notifications).toEqual([]);

    request.mockResolvedValueOnce(page(1, [{ id: "n1" }], 1, false));
    await act(async () => result.current.retry());
    expect(result.current.error).toBe("");
    expect(result.current.notifications).toEqual([{ id: "n1" }]);
    expect(result.current.unreadCount).toBe(1);
  });
});
