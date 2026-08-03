import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("../../app/utils/api", () => ({ request }));
import AutocompleteCombobox from "../../app/components/AutocompleteCombobox";
import EmailDeliveryView from "../../app/components/EmailDeliveryView";
import NotificationDrawer from "../../app/components/NotificationDrawer";
import ProfilePhotoModal from "../../app/components/ProfilePhotoModal";

beforeEach(() => {
  vi.clearAllMocks();
  request.mockReset();
});

describe("search and activity surfaces", () => {
  it("supports autocomplete filtering, keyboard selection, custom values, and toggle", async () => {
    const change = vi.fn();
    const options = [
      { value: "north", label: "North", description: "Northern region", keywords: "N" },
      { value: "south", label: "South", keywords: "S" }
    ];
    const { rerender } = render(<AutocompleteCombobox id="region" name="region" options={options} onChange={change} />);
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.type(input, "sou");
    expect(screen.getByRole("option", { name: "South" })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(change).toHaveBeenLastCalledWith("south", options[1]);
    await userEvent.click(screen.getByRole("button", { name: "Show suggestions" }));
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    rerender(<AutocompleteCombobox id="dealer" name="dealer" options={options} allowCustom onChange={change} />);
    await userEvent.clear(screen.getByRole("combobox"));
    await userEvent.type(screen.getByRole("combobox"), "Custom");
    expect(change).toHaveBeenLastCalledWith("Custom", null);
  });

  it("renders server campaign totals and delegates filters", async () => {
    const campaigns = [
      {
        id: "c1",
        createdAt: "2026-08-01T10:00:00Z",
        status: "completed",
        total: 1,
        sent: 1,
        failed: 0,
        recipients: [{ id: "r1", name: "Ravi", email: "ravi@example.com", provider: "Graph", status: "sent" }]
      }
    ];
    const updateFilters = vi.fn();
    render(
      <EmailDeliveryView
        campaigns={campaigns}
        pagination={{ page: 1, pageSize: 5, total: 1, totalPages: 1 }}
        summary={{ campaigns: 7, sent: 6, failed: 1 }}
        filters={{ search: "", status: "all" }}
        page={1}
        setPage={vi.fn()}
        updateFilters={updateFilters}
        reload={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Delivery summary")).toHaveTextContent("Campaigns7Emails sent6Failed1");
    await userEvent.type(screen.getByPlaceholderText("Search recipient or email"), "Maya");
    expect(updateFilters).toHaveBeenCalledWith({ search: "M" });
    await userEvent.selectOptions(screen.getByRole("combobox"), "successful");
    expect(updateFilters).toHaveBeenLastCalledWith({ status: "successful" });
    expect(screen.getByText("1 campaign")).toBeInTheDocument();
  });

  it("renders controlled pagination and recoverable loading and error states", async () => {
    const campaigns = Array.from({ length: 5 }, (_, index) => ({
      id: `campaign-${index + 1}`,
      createdAt: `2026-08-0${index + 1}T10:00:00Z`,
      status: "completed",
      total: 1,
      sent: 1,
      failed: 0,
      recipients: []
    }));
    const setPage = vi.fn();
    const reload = vi.fn();
    const values = {
      campaigns,
      pagination: { page: 1, pageSize: 5, total: 7, totalPages: 2 },
      summary: { campaigns: 7, sent: 7, failed: 0 },
      filters: { search: "", status: "all" },
      page: 1,
      setPage,
      updateFilters: vi.fn(),
      reload
    };
    const view = render(<EmailDeliveryView {...values} />);
    expect(screen.getAllByText("Activation campaign")).toHaveLength(5);
    expect(screen.getByText("1-5 of 7")).toBeInTheDocument();
    await userEvent.click(screen.getByTitle("Next page"));
    expect(setPage).toHaveBeenCalledWith(2);

    view.rerender(<EmailDeliveryView {...values} campaigns={[]} loading />);
    expect(screen.getByRole("heading", { name: "Loading delivery campaigns" })).toBeInTheDocument();
    view.rerender(<EmailDeliveryView {...values} campaigns={[]} error="Dependency unavailable" />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledOnce();
    view.rerender(<EmailDeliveryView {...values} campaigns={[]} summary={{ campaigns: 0, sent: 0, failed: 0 }} />);
    expect(screen.getByText("No invitation campaigns yet")).toBeInTheDocument();
  });
  it("groups notifications, opens records, and closes by keyboard and backdrop", async () => {
    const close = vi.fn(),
      open = vi.fn();
    const notifications = [
      {
        id: "n1",
        actorRole: "Regional Manager",
        actorName: "Maya",
        salesOrderId: "SO2",
        changedFields: [{ label: "Retail" }],
        createdAt: "2026-08-01T10:00:00Z"
      },
      {
        id: "n2",
        actorRole: "Area Manager",
        actorName: "Ravi",
        salesOrderId: "SO1",
        changedFields: [{ label: "Category" }]
      }
    ];
    const { container, rerender } = render(
      <NotificationDrawer open notifications={notifications} onClose={close} onOpenNotification={open} />
    );
    expect(screen.getByText("2 unread updates")).toBeInTheDocument();
    expect(screen.queryByText("->")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Unread notification: Ravi updated SO1. Open booking" })
    );
    expect(open).toHaveBeenCalledWith(notifications[1]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalled();
    fireEvent.mouseDown(container.querySelector(".notification-drawer-backdrop"));
    expect(close).toHaveBeenCalledTimes(2);
    rerender(<NotificationDrawer open notifications={[]} onClose={close} onOpenNotification={open} />);
    expect(screen.getByText("No unread updates")).toBeInTheDocument();
  });

  it("shows exact notification totals, stale recovery, and load-more controls", async () => {
    const retry = vi.fn();
    const loadMore = vi.fn();
    const notifications = [
      {
        id: "n1",
        actorRole: "Area Manager",
        actorName: "Ravi",
        salesOrderId: "SO1",
        changedFields: []
      },
      {
        id: "n2",
        actorRole: "Regional Manager",
        actorName: "Maya",
        salesOrderId: "SO2",
        changedFields: []
      }
    ];
    const view = render(
      <NotificationDrawer
        open
        notifications={notifications}
        unreadCount={25}
        pagination={{ page: 1, pageSize: 20, total: 25, totalPages: 2, hasNextPage: true }}
        error="Refresh failed"
        onRetry={retry}
        onLoadMore={loadMore}
        onClose={vi.fn()}
        onOpenNotification={vi.fn()}
      />
    );
    expect(screen.getByText("25 unread updates")).toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 25")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Loaded updates remain available");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(loadMore).toHaveBeenCalledOnce();

    view.rerender(
      <NotificationDrawer
        open
        notifications={[]}
        unreadCount={0}
        loading
        onClose={vi.fn()}
        onOpenNotification={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "Loading notifications" })).toBeInTheDocument();
  });
  it("validates and saves profile photo changes", async () => {
    const saved = vi.fn();
    const user = { name: "Admin", avatarUrl: "data:image/png;base64,AA" };
    request.mockResolvedValueOnce({ user: { ...user, avatarUrl: "" } });
    render(<ProfilePhotoModal open user={user} onClose={vi.fn()} onSaved={saved} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    await userEvent.click(screen.getByRole("button", { name: "Save photo" }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith("/api/profile", expect.objectContaining({ method: "PATCH" }));
  });
});

describe("remaining branch cases", () => {
  it("validates profile photo type and size, reads a valid image, and reports save failures", async () => {
    const user = { name: "Admin", avatarUrl: "" };
    const first = render(<ProfilePhotoModal open user={user} onClose={vi.fn()} onSaved={vi.fn()} />);
    const input = first.container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File(["text"], "photo.txt", { type: "text/plain" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("JPEG, PNG, or WebP");
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(1024 * 1024 + 1)], "large.png", { type: "image/png" })] }
    });
    expect(screen.getByRole("alert")).toHaveTextContent("smaller than 1 MB");
    vi.stubGlobal(
      "FileReader",
      class {
        readAsDataURL() {
          this.result = "data:image/png;base64,AQID";
          this.onload();
        }
      }
    );
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" })] }
    });
    expect(await screen.findByRole("button", { name: "Remove photo" })).toBeInTheDocument();
    vi.unstubAllGlobals();
    first.unmount();

    request.mockRejectedValueOnce(new Error("Profile service unavailable"));
    render(
      <ProfilePhotoModal
        open
        user={{ ...user, avatarUrl: "data:image/png;base64,AA" }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    await userEvent.click(screen.getByRole("button", { name: "Save photo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Profile service unavailable");
  });

  it("renders singular notifications with fallback role and timestamp", () => {
    render(
      <NotificationDrawer
        open
        notifications={[
          {
            id: "n3",
            actorName: "System",
            salesOrderId: "SO3",
            changedFields: []
          }
        ]}
        onClose={vi.fn()}
        onOpenNotification={vi.fn()}
      />
    );
    expect(screen.getByText("1 unread update")).toBeInTheDocument();
    expect(screen.getByText("Other updates")).toBeInTheDocument();
    expect(screen.getByText("Just now")).toBeInTheDocument();
  });
});
