import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  downloadBookingsExcel: vi.fn(),
  downloadUsersExcel: vi.fn(),
  requestText: vi.fn()
}));

vi.mock("../app/utils/api", () => ({ request: mocks.request, requestText: mocks.requestText }));
vi.mock("../app/utils/exportExcel", () => ({
  downloadBookingsExcel: mocks.downloadBookingsExcel,
  downloadUsersExcel: mocks.downloadUsersExcel
}));

import { createLoginAction, restoreDashboardSession } from "../app/features/dashboard/sessionActions";
import { createShellActions } from "../app/features/dashboard/controllerActions";
import { createUserActions } from "../app/features/users/controllerActions";
import { createBookingActions } from "../app/features/bookings/controllerActions";

function setters(names) {
  return Object.fromEntries(names.map((name) => [name, vi.fn()]));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe("login action", () => {
  function context() {
    return setters([
      "setNotice",
      "setUser",
      "setBookingFilters",
      "setBookingSearch",
      "setActiveView",
      "loadBootstrap",
      "setBookings"
    ]);
  }

  it("restores dashboard data after valid credentials", async () => {
    const ctx = context();
    mocks.request
      .mockResolvedValueOnce({ user: { id: "u1", role: "Admin" } })
      .mockResolvedValueOnce({ rows: [{ id: "b1" }] });
    const form = document.createElement("form");
    form.innerHTML = '<input name="email" value="admin@example.com"><input name="password" value="secret">';
    await createLoginAction(ctx)({ preventDefault: vi.fn(), currentTarget: form });
    expect(ctx.setUser).toHaveBeenCalledWith({ id: "u1", role: "Admin" });
    expect(ctx.loadBootstrap).toHaveBeenCalledOnce();
    expect(ctx.setBookings).toHaveBeenCalledWith([{ id: "b1" }]);
    expect(window.sessionStorage.getItem("booking-dashboard-user")).toContain("Admin");
  });

  it.each([
    ["invalid credentials", "Email or password is incorrect."],
    ["network unavailable", "We could not sign you in. Please try again."]
  ])("normalizes %s failures", async (message, expected) => {
    const ctx = context();
    mocks.request.mockRejectedValueOnce(new Error(message));
    const form = document.createElement("form");
    form.innerHTML = '<input name="email" value="a"><input name="password" value="b">';
    await createLoginAction(ctx)({ preventDefault: vi.fn(), currentTarget: form });
    expect(ctx.setNotice).toHaveBeenLastCalledWith({ message: expected, type: "error" });
  });
});

describe("session restoration", () => {
  it("clears an expired cached session and returns to sign-in", async () => {
    window.sessionStorage.setItem(
      "booking-dashboard-user",
      JSON.stringify({ id: "u1", role: "Admin" })
    );
    mocks.request.mockRejectedValueOnce(Object.assign(new Error("Authentication is required"), { status: 401 }));

    await expect(restoreDashboardSession()).resolves.toBeNull();
    expect(window.sessionStorage.getItem("booking-dashboard-user")).toBeNull();
  });

  it("preserves cached identity when the backend is temporarily unavailable", async () => {
    const cached = JSON.stringify({ id: "u1", role: "Admin" });
    window.sessionStorage.setItem("booking-dashboard-user", cached);
    mocks.request.mockRejectedValueOnce(Object.assign(new Error("Network unavailable"), { status: 503 }));

    await expect(restoreDashboardSession()).rejects.toMatchObject({ status: 503 });
    expect(window.sessionStorage.getItem("booking-dashboard-user")).toBe(cached);
  });
});

describe("user actions", () => {
  function context(overrides = {}) {
    return {
      ...setters([
        "setUserTable",
        "setUserPage",
        "setBootstrap",
        "setNotice",
        "setSingleUserErrors",
        "loadBootstrap",
        "setSingleUserModalOpen",
        "setOnboardingWorkflowId",
        "setBulkUserModalOpen",
        "setSingleUserRole"
      ]),
      filteredUsers: [{ id: "u1" }],
      bootstrap: { roleDefinitions: [] },
      ...overrides
    };
  }

  it("updates filtering, sorting, records, roles, and downloads", async () => {
    const ctx = context();
    const actions = createUserActions(ctx);
    actions.updateUserFilters({ role: "Admin" });
    actions.sortUsers("email");
    actions.userUpdated({ id: "u1", name: "Updated" });
    actions.changeSingleUserRole("Dealer");
    await actions.downloadUsers();
    expect(ctx.setUserPage).toHaveBeenCalledWith(1);
    expect(mocks.downloadUsersExcel).toHaveBeenCalledWith(ctx.filteredUsers);
    expect(ctx.setNotice).toHaveBeenLastCalledWith({ type: "success", message: "1 users downloaded." });
    const update = ctx.setBootstrap.mock.calls[0][0];
    expect(update({ users: [{ id: "u1", name: "Old" }, { id: "u2" }] }).users[0].name).toBe("Updated");
  });

  it("creates a valid user workflow and reports server validation failures", async () => {
    const ctx = context();
    const actions = createUserActions(ctx);
    const values = { Name: "Ravi", Email: "ravi@example.com", Role: "Admin", Status: "active" };
    mocks.request.mockResolvedValueOnce({ id: "w1" });
    await actions.createSingleUser(values);
    expect(ctx.setOnboardingWorkflowId).toHaveBeenCalledWith("w1");
    expect(ctx.setBulkUserModalOpen).toHaveBeenCalledWith(true);

    mocks.request.mockRejectedValueOnce({
      message: "Rejected",
      payload: { errors: [{ columnName: "Email", errorMessage: "Exists" }] }
    });
    await actions.createSingleUser(values);
    expect(ctx.setSingleUserErrors).toHaveBeenLastCalledWith({ Email: "Exists" });
    expect(ctx.setNotice).toHaveBeenLastCalledWith({ message: "Email: Exists", type: "error" });
  });

  it("stops before the API when client validation fails and handles download errors", async () => {
    const ctx = context();
    const actions = createUserActions(ctx);
    await actions.createSingleUser({});
    expect(mocks.request).not.toHaveBeenCalled();
    mocks.downloadUsersExcel.mockRejectedValueOnce(new Error("Disk full"));
    await actions.downloadUsers();
    expect(ctx.setNotice).toHaveBeenLastCalledWith({ type: "error", message: "Disk full" });
  });
});

describe("dashboard shell actions", () => {
  function context(overrides = {}) {
    return {
      ...setters([
        "setUser",
        "setBootstrap",
        "setBookings",
        "setActiveView",
        "setBookingFilters",
        "setBookingSearch",
        "setNotice",
        "setNotifications",
        "setNotificationDrawerOpen",
        "setBookingUploadModalOpen",
        "setBookingWorkspaceView",
        "setChangePasswordOpen",
        "setProfilePhotoOpen",
        "setDetailFilter",
        "setSelectedBooking",
        "setBookingPage",
        "loadBookings",
        "setAbortingWorkflow",
        "setAbortWorkflow",
        "loadBootstrap"
      ]),
      user: { id: "u1", role: "Admin" },
      bookingFilters: { search: "" },
      bookings: [{ id: "b1" }],
      abortWorkflow: { id: "w1" },
      ...overrides
    };
  }

  it("clears local state on logout even if the server session is gone", async () => {
    const ctx = context();
    mocks.request.mockRejectedValueOnce(new Error("expired"));
    window.sessionStorage.setItem("booking-dashboard-user", "cached");
    await createShellActions(ctx).logout();
    expect(window.sessionStorage.getItem("booking-dashboard-user")).toBeNull();
    expect(ctx.setUser).toHaveBeenCalledWith(null);
    expect(ctx.setBookingWorkspaceView).toHaveBeenCalledWith("workflow");
  });

  it("handles password and profile updates", () => {
    const ctx = context();
    const actions = createShellActions(ctx);
    actions.passwordChanged();
    actions.profilePhotoSaved({ id: "u1", name: "Ravi" });
    expect(ctx.setChangePasswordOpen).toHaveBeenCalledWith(false);
    expect(ctx.setProfilePhotoOpen).toHaveBeenCalledWith(false);
    const update = ctx.setBootstrap.mock.calls.at(-1)[0];
    expect(update({ users: [{ id: "u1", name: "Old" }] }).users[0].name).toBe("Ravi");
    expect(update(null)).toBeNull();
  });

  it("opens a notification booking and supports existing and new rows", async () => {
    const ctx = context();
    mocks.request.mockResolvedValueOnce({ booking: { id: "b1", model: "Duster" } }).mockResolvedValueOnce({});
    await createShellActions(ctx).openNotification({ id: "n1", bookingId: "b1" });
    const update = ctx.setBookings.mock.calls[0][0];
    expect(update([{ id: "b1" }])[0].model).toBe("Duster");
    expect(update([{ id: "b2" }])[0].id).toBe("b1");
    expect(ctx.setSelectedBooking).toHaveBeenCalledWith({ id: "b1", model: "Duster" });
  });

  it("reports notification and download errors and delegates metric selection", async () => {
    const ctx = context();
    const actions = createShellActions(ctx);
    mocks.request.mockRejectedValueOnce(new Error("Not found"));
    await actions.openNotification({ id: "n1", bookingId: "missing" });
    await actions.metricClick("pending");
    mocks.downloadBookingsExcel.mockRejectedValueOnce(new Error("Blocked"));
    await actions.handleDownloadBookings();
    expect(ctx.loadBookings).toHaveBeenCalledWith(ctx.bookingFilters, "pending");
    expect(ctx.setNotice).toHaveBeenLastCalledWith({ type: "error", message: "Blocked" });
  });

  it("handles successful aborts, refresh warnings, and API errors", async () => {
    const ctx = context();
    const actions = createShellActions(ctx);
    mocks.request.mockResolvedValueOnce({});
    await actions.confirmAbortWorkflow();
    expect(ctx.setAbortWorkflow).toHaveBeenCalledWith(null);
    expect(ctx.setAbortingWorkflow).toHaveBeenLastCalledWith(false);

    ctx.loadBootstrap.mockRejectedValueOnce(new Error("refresh"));
    mocks.request.mockResolvedValueOnce({});
    await actions.confirmAbortWorkflow();
    expect(ctx.setNotice).toHaveBeenLastCalledWith(expect.objectContaining({ type: "warning" }));

    mocks.request.mockRejectedValueOnce({ message: "Denied", payload: { error: "Forbidden" } });
    await actions.confirmAbortWorkflow();
    expect(ctx.setNotice).toHaveBeenLastCalledWith({ type: "error", message: "Forbidden" });
  });
});

describe("booking actions", () => {
  function context(overrides = {}) {
    return {
      ...setters([
        "setBookingFilters",
        "setBookingPage",
        "setExcelPage",
        "loadBookings",
        "setExcelFilters",
        "setDetailFilter",
        "setBookingSearch",
        "loadBootstrap",
        "setNotice",
        "setUploadPreview",
        "setPendingBookingUpload",
        "setBookingUploadModalOpen",
        "setSelectedBooking",
        "setSelectedAreaField",
        "setAreaOptionSearch",
        "setAreaOptionStatus",
        "setEditingOptionId",
        "setOptionDraft",
        "setBootstrap",
        "setAddOptionError",
        "setAddOptionModalOpen"
      ]),
      bookingFilters: { search: "", region: "North" },
      detailFilter: "all",
      pendingBookingUpload: { fileName: "bookings.csv", content: "ID\n1" },
      canAreaEdit: true,
      canRegionalEdit: true,
      selectedBooking: { id: "b1" },
      user: { id: "u1" },
      selectedAreaField: "bookingCategory",
      ...overrides
    };
  }

  it("updates and clears workflow and source filters", async () => {
    const ctx = context();
    const actions = createBookingActions(ctx);
    await actions.changeBookingFilters({ search: "SOB" });
    actions.updateExcelFilters({ workflow: "pending" });
    await actions.clearBookingFilters();
    expect(ctx.loadBookings).toHaveBeenNthCalledWith(1, { search: "SOB", region: "North" }, "all");
    expect(ctx.loadBookings).toHaveBeenLastCalledWith(
      { search: "", region: "", wholesaleInput: "", retailInput: "" },
      "all"
    );
    expect(ctx.setDetailFilter).toHaveBeenCalledWith("all");
  });

  it("previews selected and sample files and removes the preview", async () => {
    const ctx = context();
    const actions = createBookingActions(ctx);
    const target = {
      files: [{ name: "bookings.csv", text: vi.fn().mockResolvedValue("ID,Model\n1,Duster") }],
      value: "selected"
    };
    await actions.previewBookingFile({ target });
    expect(ctx.setUploadPreview).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "bookings.csv", headers: ["ID", "Model"] })
    );
    expect(target.value).toBe("");
    await actions.previewBookingFile({ target: { files: [] } });
    mocks.requestText.mockResolvedValueOnce("ID\n2");
    await actions.loadSampleBookingUpload();
    actions.removeBookingUpload();
    expect(ctx.setPendingBookingUpload).toHaveBeenLastCalledWith(null);
    expect(ctx.setNotice).toHaveBeenLastCalledWith(null);
  });

  it("submits booking uploads and preserves failed previews", async () => {
    const ctx = context();
    mocks.request.mockResolvedValueOnce({
      originalFileName: "bookings.csv",
      status: "completed",
      insertedRows: 1,
      updatedRows: 2,
      failedRows: 0
    });
    await createBookingActions(ctx).submitBookingUpload();
    expect(ctx.setBookingUploadModalOpen).toHaveBeenCalledWith(false);
    expect(ctx.loadBootstrap).toHaveBeenCalledOnce();

    const failed = context();
    mocks.request.mockRejectedValueOnce({
      message: "Invalid",
      payload: { errors: [{ columnName: "Model", errorMessage: "Unknown" }] }
    });
    await createBookingActions(failed).submitBookingUpload();
    expect(failed.setBookingUploadModalOpen).not.toHaveBeenCalled();
    expect(failed.setNotice).toHaveBeenLastCalledWith({ message: "Model: Unknown", type: "error" });

    const empty = context({ pendingBookingUpload: null });
    await createBookingActions(empty).submitBookingUpload();
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });

  it("enforces role ownership and saves area and regional forms", async () => {
    const readonly = context({ canAreaEdit: false, canRegionalEdit: false });
    const emptyForm = document.createElement("form");
    await createBookingActions(readonly).saveArea({ preventDefault: vi.fn(), currentTarget: emptyForm });
    await createBookingActions(readonly).saveRegional({ preventDefault: vi.fn(), currentTarget: emptyForm });
    expect(mocks.request).not.toHaveBeenCalled();
    expect(readonly.setNotice).toHaveBeenLastCalledWith(expect.objectContaining({ type: "warning" }));

    const ctx = context();
    const form = document.createElement("form");
    form.innerHTML = '<input name="status" value="confirmed">';
    mocks.request.mockResolvedValue({});
    await createBookingActions(ctx).saveArea({ preventDefault: vi.fn(), currentTarget: form });
    await createBookingActions(ctx).saveRegional({ preventDefault: vi.fn(), currentTarget: form });
    expect(mocks.request).toHaveBeenCalledTimes(2);
    expect(ctx.setSelectedBooking).toHaveBeenLastCalledWith(null);
  });

  it("changes fields and handles lookup create, update, validation, and errors", async () => {
    const ctx = context();
    const actions = createBookingActions(ctx);
    actions.changeAreaField("vehicleModel");
    actions.closeAddOptionModal();
    await actions.addLookupOption("");
    expect(ctx.setAddOptionError).toHaveBeenCalledWith("Option value is required.");

    const result = { lookups: {}, lookupOptions: { bookingCategory: [] } };
    mocks.request.mockResolvedValueOnce(result).mockResolvedValueOnce(result);
    await actions.addLookupOption("Priority");
    await actions.updateLookupOption("o1", { active: false }, "Updated");
    expect(ctx.setNotice).toHaveBeenLastCalledWith({ message: "Updated", type: "success" });

    mocks.request.mockRejectedValueOnce({ message: "Denied", payload: { error: "Duplicate" } });
    await actions.addLookupOption("Priority");
    mocks.request.mockRejectedValueOnce(new Error("Offline"));
    await actions.updateLookupOption("o1", {}, "Updated");
    expect(ctx.setNotice).toHaveBeenLastCalledWith({ message: "Offline", type: "error" });
  });
});
