import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../app/utils/api", () => ({ request }));
import EditableUsersTable from "../../app/components/EditableUsersTable";
import SingleUserModal from "../../app/features/users/SingleUserModal";

beforeEach(() => {
  vi.clearAllMocks();
  request.mockReset();
});

const user = {
  id: "u1",
  name: "Ravi",
  email: "ravi@example.com",
  role: "Dealer",
  region: "North",
  status: "active",
  phone: "9000000000",
  dealerCode: "D1",
  reportingManagerEmail: "manager@example.com"
};

describe("single-user modal", () => {
  function props(overrides = {}) {
    return {
      open: true,
      roles: ["Admin", "Area Manager", "Dealer"],
      regions: ["North"],
      dealerCodes: [],
      onDataChanged: vi.fn(),
      roleDefinitions: [
        { name: "Area Manager", code: "AM", managerRoleCode: "RM" },
        { name: "Regional Manager", code: "RM" }
      ],
      role: "Area Manager",
      errors: {},
      onRoleChange: vi.fn(),
      onClearError: vi.fn(),
      onClose: vi.fn(),
      onSubmit: vi.fn(),
      ...overrides
    };
  }

  it("renders role requirements, clears errors, and submits mapped values", async () => {
    const values = props({ errors: { Name: "Required" } });
    render(<SingleUserModal {...values} />);
    expect(screen.getByText("Required")).toHaveAttribute("id", "single-user-Name-error");
    expect(screen.getByText("Enter an active reporting manager account email.")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Ravi");
    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "ravi@example.com");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Region" }), "North");
    await userEvent.type(screen.getByRole("textbox", { name: "Reporting Manager Email" }), "manager@example.com");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Role" }), "Admin");
    await userEvent.click(screen.getByRole("button", { name: "Continue to invitation" }));
    expect(values.onRoleChange).toHaveBeenCalledWith("Admin");
    expect(values.onClearError).toHaveBeenCalled();
    expect(values.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ Name: "Ravi", Email: "ravi@example.com" }));
  });

  it("keeps phone input numeric and blocks values shorter than 10 digits", async () => {
    const values = props({ role: "Admin" });
    render(<SingleUserModal {...values} />);
    const phone = screen.getByRole("textbox", { name: "Phone" });

    await userEvent.type(phone, "12ab3456789012");
    expect(phone).toHaveValue("1234567890");
    expect(phone).toHaveAttribute("inputmode", "numeric");

    await userEvent.clear(phone);
    await userEvent.type(phone, "12345");
    await userEvent.click(screen.getByRole("button", { name: "Continue to invitation" }));
    expect(screen.getByText("Phone must contain exactly 10 digits.")).toBeInTheDocument();
    expect(values.onSubmit).not.toHaveBeenCalled();
  });
  it("submits safe defaults for roles without region or manager requirements", async () => {
    const values = props({ role: "Admin" });
    render(<SingleUserModal {...values} />);
    expect(screen.queryByRole("combobox", { name: "Region" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Reporting Manager Email" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Dealer Code" }).closest(".field")).toHaveClass(
      "single-user-dealer-field"
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Admin Two");
    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "admin.two@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Continue to invitation" }));
    expect(values.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        Region: "All",
        "Reporting Manager Email": ""
      })
    );
  });
  it("links a selected Dealer Code to its Region", async () => {
    const values = props({
      dealerCodes: [{ id: "d1", code: "N-001", region: "North", status: "active" }]
    });
    render(<SingleUserModal {...values} />);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Dealer Code" }), "N-001");

    const region = screen.getByRole("combobox", { name: "Region" });
    expect(region).toHaveValue("North");
    expect(region).toBeDisabled();
    expect(screen.getByText("Region is linked to the selected Dealer Code.")).toBeInTheDocument();
  });

  it("lets an admin add a missing Region and return to Dealer Code creation", async () => {
    const values = props({ regions: [] });
    render(<SingleUserModal {...values} />);
    await userEvent.click(screen.getByRole("button", { name: "Add Dealer Code" }));
    await userEvent.click(screen.getByRole("button", { name: "Add Region" }));

    request.mockResolvedValueOnce({
      region: { id: "r2", name: "North East", status: "active" },
      collectionUrl: "/api/admin/reference-data?collection=regions"
    });
    await userEvent.type(screen.getByRole("textbox", { name: "Region name" }), "North East");
    await userEvent.click(screen.getByRole("button", { name: "Add and select Region" }));

    expect(screen.getByRole("heading", { name: "Add Dealer Code" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Region" })).toHaveValue("North East");
  });
  it("adds Region and Dealer Code without losing entered user values", async () => {
    const values = props();
    render(<SingleUserModal {...values} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Preserved User");
    await userEvent.click(screen.getByRole("button", { name: "Add Region" }));
    request.mockResolvedValueOnce({
      region: { id: "r2", name: "North East", status: "active" },
      collectionUrl: "/api/admin/reference-data?collection=regions"
    });
    await userEvent.type(screen.getByRole("textbox", { name: "Region name" }), "North East");
    await userEvent.click(screen.getByRole("button", { name: "Add and select Region" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Preserved User");
    expect(screen.getByRole("combobox", { name: "Region" })).toHaveValue("North East");

    await userEvent.click(screen.getByRole("button", { name: "Add Dealer Code" }));
    request.mockResolvedValueOnce({
      dealerCode: { id: "d1", code: "NE-001", region: "North East", status: "active" },
      collectionUrl: "/api/admin/reference-data?collection=dealerCodes"
    });
    await userEvent.type(screen.getByRole("textbox", { name: "Dealer Code" }), "NE-001");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Region" }), "North East");
    await userEvent.click(screen.getByRole("button", { name: "Add and select Dealer Code" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Preserved User");
    expect(screen.getByRole("combobox", { name: "Dealer Code" })).toHaveValue("NE-001");
    expect(values.onDataChanged).toHaveBeenCalledTimes(2);
  });
});

describe("editable users table", () => {
  function renderTable(overrides = {}) {
    const values = {
      users: [user],
      roles: ["Dealer", "Area Manager"],
      regions: ["North", "South"],
      dealerCodes: [
        { id: "d1", code: "D1", region: "North", status: "active" },
        { id: "d2", code: "S1", region: "South", status: "active" }
      ],
      updatedBy: "admin",
      sortState: { key: "name", direction: "asc" },
      onSort: vi.fn(),
      onUserUpdated: vi.fn(),
      ...overrides
    };
    return { values, ...render(<EditableUsersTable {...values} />) };
  }

  it("shows Dealer Code, sorts supported columns, and shows empty results", async () => {
    const { values, rerender } = renderTable();
    expect(screen.getByRole("columnheader", { name: "Dealer Code" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "D1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dealer Code/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(values.onSort).toHaveBeenCalledWith("name");
    rerender(<EditableUsersTable {...values} users={[]} />);
    expect(screen.getByText("No users match the current filters.")).toBeInTheDocument();
  });

  it("edits and saves a valid user", async () => {
    const { values } = renderTable();
    request.mockResolvedValueOnce({ user: { ...user, name: "Ravi Kumar" } });
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText("Name for ravi@example.com");
    await userEvent.clear(name);
    await userEvent.type(name, "Ravi Kumar");
    await userEvent.selectOptions(screen.getByLabelText("Region for Ravi"), "South");
    expect(screen.getByLabelText("Dealer Code for Ravi")).toHaveValue("");
    expect(screen.getByText("Changing Region clears an incompatible Dealer Code.")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Status for Ravi"), "inactive");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(request).toHaveBeenCalledWith(
      "/api/ui/users/update",
      expect.objectContaining({ method: "PATCH", body: expect.stringContaining('"dealerCode":""') })
    );
    expect(values.onUserUpdated).toHaveBeenCalledWith(expect.objectContaining({ name: "Ravi Kumar" }));
    expect(await screen.findByText(/updated successfully/i)).toBeInTheDocument();
  });

  it("validates required values and maps server field errors", async () => {
    const { unmount } = renderTable();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.clear(screen.getByLabelText("Name for ravi@example.com"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText(/highlighted required fields/i)).toBeInTheDocument();
    unmount();

    request.mockRejectedValueOnce({
      message: "The request could not be completed.",
      payload: { errors: [{ columnName: "Email", errorMessage: "Already exists" }] }
    });
    renderTable();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getAllByText("Already exists")).toHaveLength(2);
  });

  it("prompts before discarding dirty edits and supports stay, Escape, and discard", async () => {
    renderTable();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Name for ravi@example.com"), " changed");
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Stay Editing" }));
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    await userEvent.click(screen.getByRole("button", { name: "Discard Changes" }));
    expect(screen.queryByLabelText("Name for ravi@example.com")).not.toBeInTheDocument();
  });

  it("lets an Admin set a temporary password from a focus-managed drawer", async () => {
    renderTable();
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect(screen.getByRole("dialog", { name: "Set temporary password" })).toBeInTheDocument();
    expect(screen.getAllByText("ravi@example.com")).toHaveLength(2);

    await userEvent.type(screen.getByLabelText(/New password/), "TemporaryPass123");
    await userEvent.type(screen.getByLabelText(/Confirm password/), "TemporaryPass456");
    await userEvent.click(screen.getByRole("button", { name: "Set temporary password" }));
    expect(screen.getAllByText("Passwords do not match.").length).toBeGreaterThan(0);
    expect(request).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText(/Confirm password/));
    await userEvent.type(screen.getByLabelText(/Confirm password/), "TemporaryPass123");
    request.mockResolvedValueOnce({ updated: true, mustChangePassword: true });
    await userEvent.click(screen.getByRole("button", { name: "Set temporary password" }));
    expect(request).toHaveBeenCalledWith(
      "/api/admin/users/u1/temporary-password",
      expect.objectContaining({ method: "POST" })
    );
    expect(await screen.findByText("Temporary password updated")).toBeInTheDocument();
    expect(screen.getByText(/Existing sessions and password reset links have been revoked/i)).toBeInTheDocument();
  });
  it("activates a pending user while setting the temporary password", async () => {
    const pendingUser = { ...user, status: "pending_invitation" };
    const { values } = renderTable({ users: [pendingUser] });
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect(screen.getByRole("dialog", { name: "Activate account" })).toBeInTheDocument();
    expect(screen.getByText(/immediately activates the account/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/New password/), "TemporaryPass123");
    await userEvent.type(screen.getByLabelText(/Confirm password/), "TemporaryPass123");
    request.mockResolvedValueOnce({
      updated: true,
      activated: true,
      user: { ...pendingUser, status: "active", mustChangePassword: true }
    });
    await userEvent.click(screen.getByRole("button", { name: "Activate and set password" }));

    expect(request).toHaveBeenCalledWith(
      "/api/admin/users/u1/temporary-password",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"activatePending":true')
      })
    );
    expect(values.onUserUpdated).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
    expect(await screen.findByText("Account activated")).toBeInTheDocument();
  });
});
