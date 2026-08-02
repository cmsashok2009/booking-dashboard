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

  it("summarizes, filters, expands, and empties delivery campaigns", async () => {
    const campaigns = [
      {
        id: "c1",
        createdAt: "2026-08-01T10:00:00Z",
        status: "completed",
        total: 1,
        sent: 1,
        failed: 0,
        recipients: [
          {
            id: "r1",
            name: "Ravi",
            email: "ravi@example.com",
            provider: "Graph",
            status: "sent",
            sentAt: "2026-08-01T10:01:00Z"
          }
        ]
      },
      {
        id: "c2",
        createdAt: "2026-07-31T10:00:00Z",
        status: "completed",
        total: 1,
        sent: 0,
        failed: 1,
        recipients: [
          {
            id: "r2",
            name: "Maya",
            email: "maya@example.com",
            provider: "Graph",
            status: "failed",
            failureReason: "Rejected"
          }
        ]
      }
    ];
    const view = render(<EmailDeliveryView campaigns={campaigns} />);
    expect(screen.getByLabelText("Delivery summary")).toHaveTextContent("Emails sent1");
    await userEvent.type(screen.getByPlaceholderText("Search recipient or email"), "Maya");
    expect(screen.getByText("1 campaign")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox"), "successful");
    expect(screen.getByText("No matching campaigns")).toBeInTheDocument();
    view.rerender(<EmailDeliveryView campaigns={[]} />);
    expect(screen.getByText("No invitation campaigns yet")).toBeInTheDocument();
  });

  it("shows the five newest delivery campaigns first and paginates older campaigns", async () => {
    const campaigns = Array.from({ length: 7 }, (_, index) => ({
      id: `campaign-${index + 1}`,
      createdAt: `2026-08-0${index + 1}T10:00:00Z`,
      status: "completed",
      total: 1,
      sent: 1,
      failed: 0,
      recipients: []
    }));

    render(<EmailDeliveryView campaigns={campaigns} />);

    const firstPage = screen.getAllByText("Activation campaign");
    expect(firstPage).toHaveLength(5);
    expect(firstPage[0].closest("details")).toHaveTextContent(new Date("2026-08-07T10:00:00Z").toLocaleString());
    expect(screen.getByText("1-5 of 7")).toBeInTheDocument();

    await userEvent.click(screen.getByTitle("Next page"));
    const secondPage = screen.getAllByText("Activation campaign");
    expect(secondPage).toHaveLength(2);
    expect(secondPage[1].closest("details")).toHaveTextContent(new Date("2026-08-01T10:00:00Z").toLocaleString());
    expect(screen.getByText("6-7 of 7")).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: /Ravi updated SO1/ }));
    expect(open).toHaveBeenCalledWith(notifications[1]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalled();
    fireEvent.mouseDown(container.querySelector(".notification-drawer-backdrop"));
    expect(close).toHaveBeenCalledTimes(2);
    rerender(<NotificationDrawer open notifications={[]} onClose={close} onOpenNotification={open} />);
    expect(screen.getByText("No unread updates")).toBeInTheDocument();
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
