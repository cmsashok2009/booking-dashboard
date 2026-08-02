import { describe, expect, it, vi } from "vitest";
import { buildDashboardViewModel } from "../app/features/dashboard/viewModel";

function createContext(overrides = {}) {
  const fn = vi.fn();
  const target = {
    sessionReady: true,
    sessionError: "",
    user: { id: "u1", role: "Admin" },
    notice: null,
    login: fn,
    activeView: "users",
    canAdmin: true,
    notifications: [],
    notificationDrawerOpen: false,
    metrics: { total: 2 },
    dashboardInsights: [],
    bookings: [],
    detailFilter: "all",
    bookingWorkspaceView: "workflow",
    bookingPage: 1,
    bookingSearch: "",
    bookingFilters: { search: "", region: "", wholesaleInput: "", retailInput: "" },
    bootstrap: {
      regions: ["North"],
      users: [],
      roles: ["Admin"],
      roleDefinitions: [],
      onboardingWorkflows: [],
      emailTemplates: [],
      emailTemplateSamples: [],
      emailCampaigns: [],
      emailProvider: null,
      lookupOptions: { bookingCategory: [] }
    },
    canAreaEdit: false,
    excelFilters: { search: "", region: "", workflow: "" },
    excelPage: 1,
    selectedAreaField: "bookingCategory",
    areaOptionSearch: "",
    areaOptionStatus: "",
    editingOptionId: null,
    optionDraft: "",
    filteredUsers: [],
    userTable: {},
    userPage: 1,
    preferredOnboardingTemplateId: "",
    templateReturnWorkflowId: "workflow-1",
    changePasswordOpen: false,
    profilePhotoOpen: false,
    singleUserModalOpen: false,
    singleUserRole: "",
    singleUserErrors: {},
    selectedBooking: null,
    canRegionalEdit: false,
    addOptionModalOpen: false,
    addOptionError: "",
    bookingUploadModalOpen: false,
    uploadPreview: null,
    pendingBookingUpload: null,
    abortWorkflow: null,
    abortingWorkflow: false,
    ...overrides
  };
  return new Proxy(target, {
    get(object, key) {
      if (key in object) return object[key];
      object[key] = vi.fn();
      return object[key];
    }
  });
}

describe("dashboard view model", () => {
  it("maps controller state into shell, feature, and overlay contracts", () => {
    const context = createContext();
    const result = buildDashboardViewModel(context);
    expect(result.sessionReady).toBe(true);
    expect(result.shellState).toMatchObject({ activeView: "users", canAdmin: true });
    expect(result.models.bookings.workspace.workflow.regions).toEqual(["North"]);
    expect(result.models.areaFields.selectedField).toBe("bookingCategory");
    expect(result.models.users.onboarding.workflowId).toBe(context.onboardingWorkflowId);
    expect(result.models.email.settings.provider).toBeNull();
    expect(result.overlayState.bookingUploadModalOpen).toBe(false);
  });

  it("delegates inline shell, feature, and overlay actions", () => {
    const context = createContext();
    const result = buildDashboardViewModel(context);
    result.shellActions.openNotifications();
    result.shellActions.openProfilePhoto();
    result.shellActions.openChangePassword();
    result.shellActions.clearNotice();
    result.models.bookings.workspace.onViewChange("source");
    result.models.bookings.workspace.onOpenUpload();
    result.models.bookings.workspace.workflow.onSearchChange("SOB");
    result.models.bookings.workspace.workflow.onRefresh();
    result.models.bookings.workspace.workflow.onOpenBooking({ id: "b1" });
    result.models.bookings.workspace.workflow.onPageChange(2);
    result.models.bookings.workspace.source.onPageChange(3);
    result.models.areaFields.onStartEdit({ id: "o1", label: "Priority" });
    result.models.areaFields.onCancelEdit();
    result.models.areaFields.onOpenAdd();
    result.models.users.onAddSingle();
    result.models.users.onAddBulk();
    result.models.users.onContinueWorkflow({ id: "w1" });
    result.models.users.onboarding.onClose();
    result.models.users.onboarding.onCreateTemplate("w2");
    result.overlayActions.closeChangePassword();
    result.overlayActions.closeProfilePhoto();
    result.overlayActions.clearSingleUserError("Email");
    result.overlayActions.closeSingleUser();
    result.overlayActions.closeBookingDetails();
    result.overlayActions.closeBookingUpload();
    result.overlayActions.closeNotifications();
    result.overlayActions.closeAbortWorkflow();
    expect(context.setNotificationDrawerOpen).toHaveBeenCalledWith(true);
    expect(context.setEditingOptionId).toHaveBeenCalledWith("o1");
    expect(context.navigate).toHaveBeenCalledWith("email-templates");
  });

  it("returns an activated template to its paused onboarding workflow", () => {
    const context = createContext();
    const result = buildDashboardViewModel(context);
    result.models.email.templates.onReturnToOnboarding({ id: "t1", name: "Activation" });
    expect(context.setPreferredOnboardingTemplateId).toHaveBeenCalledWith("t1");
    expect(context.setOnboardingWorkflowId).toHaveBeenCalledWith("workflow-1");
    expect(context.setBulkUserModalOpen).toHaveBeenCalledWith(true);
    result.models.email.templates.onReturnToOnboarding();
    expect(context.setPreferredOnboardingTemplateId).toHaveBeenLastCalledWith("");
  });
});
