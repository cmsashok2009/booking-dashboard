import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import UsersWorkspace from "../../app/features/users/UsersWorkspace";

const admin = { id: "admin", name: "Admin", role: "Admin", status: "active" };
const dealer = { id: "u1", name: "Ravi", email: "ravi@example.com", role: "Dealer", region: "North", status: "active" };

function props(overrides = {}) {
  return {
    activeView: "users",
    user: admin,
    users: [admin, dealer],
    filteredUsers: [dealer],
    totalUsers: 1,
    filters: { search: "", role: "", status: "", region: "", sortKey: "name", sortDir: "asc" },
    page: 1,
    roles: ["Dealer"],
    regions: ["North"],
    workflows: [{ id: "w1", fileName: "users.csv", currentStep: "template", status: "active" }],
    onboarding: { open: false },
    onAddSingle: vi.fn(),
    onAddBulk: vi.fn(),
    onAbortWorkflow: vi.fn(),
    onContinueWorkflow: vi.fn(),
    onDownload: vi.fn(),
    onFilterChange: vi.fn(),
    onSort: vi.fn(),
    onUserUpdated: vi.fn(),
    onPageChange: vi.fn(),
    onRetry: vi.fn(),
    ...overrides
  };
}

describe("users workspace", () => {
  it("supports entry actions, workflow resume, download, filtering, sorting, and clear", async () => {
    const values = props();
    render(<UsersWorkspace {...values} />);
    expect(screen.getByRole("tab", { name: "Current Users" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Add Users" }));
    await userEvent.click(screen.getByRole("button", { name: "Add Single User" }));
    await userEvent.click(screen.getByRole("button", { name: "Bulk Upload" }));
    await userEvent.click(screen.getByRole("button", { name: "Abort" }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("tab", { name: "Current Users" }));
    await userEvent.click(screen.getByRole("button", { name: "Download Users" }));
    await userEvent.type(screen.getByLabelText("Search users"), "Ravi");
    await userEvent.selectOptions(screen.getByLabelText("Filter users by role"), "Dealer");
    await userEvent.selectOptions(screen.getByLabelText("Filter users by status"), "active");
    await userEvent.selectOptions(screen.getByLabelText("Filter users by region"), "North");
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    await userEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(values.onAddSingle).toHaveBeenCalledOnce();
    expect(values.onAbortWorkflow).toHaveBeenCalledWith(values.workflows[0]);
    expect(values.onContinueWorkflow).toHaveBeenCalledWith(values.workflows[0]);
    expect(values.onFilterChange).toHaveBeenCalledWith({ search: "", role: "", status: "", region: "" });
    expect(values.onSort).toHaveBeenCalledWith("name");
  });

  it("fills filters from role, status, and region catalogs", () => {
    render(
      <UsersWorkspace
        {...props({
          roles: ["Area Manager", "Regional Manager", "All India I", "All India II", "All India", "Admin"],
          regions: ["North", "South", "East", "West", "Central"]
        })}
      />
    );
    const roleOptions = [...screen.getByLabelText("Filter users by role").options].map((option) => option.text);
    expect(roleOptions).toEqual(
      expect.arrayContaining(["Area Manager", "Regional Manager", "All India I", "All India II", "All India", "Admin"])
    );
    expect(screen.getByLabelText("Filter users by status")).toHaveTextContent("Pending Invitation");
    expect(screen.getByLabelText("Filter users by region")).toHaveTextContent("Central");
  });
  it("hides completed workflows and reports empty user views", () => {
    render(
      <UsersWorkspace
        {...props({ users: [admin], filteredUsers: [], workflows: [{ id: "w2", status: "completed" }] })}
      />
    );
    expect(screen.queryByText("Onboarding in progress")).not.toBeInTheDocument();
    expect(screen.getByText("No users match the current filters.")).toBeInTheDocument();
    expect(screen.getByText("0 users match the current view.")).toBeInTheDocument();
  });
  it("shows loading and recoverable user collection failures", async () => {
    const values = props({ loading: true });
    const { rerender } = render(<UsersWorkspace {...values} />);
    expect(screen.getByRole("heading", { name: "Loading users" })).toBeInTheDocument();
    expect(screen.queryByText("Ravi")).not.toBeInTheDocument();

    rerender(<UsersWorkspace {...values} loading={false} error="Dependency unavailable" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Dependency unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Retry users" }));
    expect(values.onRetry).toHaveBeenCalledOnce();
  });
});
