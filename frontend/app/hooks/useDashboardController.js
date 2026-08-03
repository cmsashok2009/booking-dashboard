"use client";

import { useEffect, useMemo, useState } from "react";
import { buildDashboardInsights, buildDashboardMetrics } from "../features/dashboard/selectors";
import { buildDashboardViewModel } from "../features/dashboard/viewModel";
import { createNavigationAction, createShellActions } from "../features/dashboard/controllerActions";
import { createLoginAction, restoreDashboardSession } from "../features/dashboard/sessionActions";
import { createUserActions } from "../features/users/controllerActions";
import { applyDetailFilter } from "../utils/bookings";
import { request } from "../utils/api";
import { createBookingActions } from "../features/bookings/controllerActions";
import loadDashboardBookings from "../features/bookings/loadDashboardBookings";
import useDashboardNotifications from "./useDashboardNotifications";
import useDashboardCollections from "./useDashboardCollections";

const EMPTY_BOOKING_FILTERS = { search: "", region: "", wholesaleInput: "", retailInput: "" };

export default function useDashboardController() {
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [profilePhotoOpen, setProfilePhotoOpen] = useState(false);
  const [bootstrap, setBootstrap] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailFilter, setDetailFilter] = useState("all");
  const [bookingPage, setBookingPage] = useState(1);
  const [excelPage, setExcelPage] = useState(1);
  const [excelFilters, setExcelFilters] = useState({ search: "", region: "", workflow: "" });
  const [bookingFilters, setBookingFilters] = useState({ ...EMPTY_BOOKING_FILTERS });
  const [uploadPreview, setUploadPreview] = useState(null);
  const [pendingBookingUpload, setPendingBookingUpload] = useState(null);
  const [selectedAreaField, setSelectedAreaField] = useState("roles");
  const [addOptionModalOpen, setAddOptionModalOpen] = useState(false);
  const [userTable, setUserTable] = useState({
    search: "",
    role: "",
    status: "",
    region: "",
    sortKey: "name",
    sortDir: "asc"
  });
  const [notice, setNotice] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [singleUserModalOpen, setSingleUserModalOpen] = useState(false);
  const [bulkUserModalOpen, setBulkUserModalOpen] = useState(false);
  const [onboardingWorkflowId, setOnboardingWorkflowId] = useState("");
  const [templateReturnWorkflowId, setTemplateReturnWorkflowId] = useState("");
  const [preferredOnboardingTemplateId, setPreferredOnboardingTemplateId] = useState("");
  const notificationState = useDashboardNotifications(user?.id);
  const [bookingWorkspaceView, setBookingWorkspaceView] = useState("workflow");
  const [bookingUploadModalOpen, setBookingUploadModalOpen] = useState(false);
  const [bookingSearch, setBookingSearch] = useState("");
  const [areaOptionSearch, setAreaOptionSearch] = useState("");
  const [areaOptionStatus, setAreaOptionStatus] = useState("");
  const [editingOptionId, setEditingOptionId] = useState(null);
  const [optionDraft, setOptionDraft] = useState("");
  const [addOptionError, setAddOptionError] = useState("");
  const [singleUserErrors, setSingleUserErrors] = useState({});
  const [singleUserRole, setSingleUserRole] = useState("");
  const [abortWorkflow, setAbortWorkflow] = useState(null);
  const [abortingWorkflow, setAbortingWorkflow] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [regionDependencyConflict, setRegionDependencyConflict] = useState(null);

  const canAdmin = user?.role === "Admin";
  const canAreaEdit = user?.role === "Area Manager";
  const canRegionalEdit = user?.role === "Regional Manager";
  async function loadBootstrap() {
    const payload = await request("/api/bootstrap");
    setBootstrap(payload);
    return payload;
  }
  async function loadBookings(nextFilters = bookingFilters, nextDetailFilter = detailFilter) {
    const payload = await loadDashboardBookings(user, nextFilters);
    setBookings(applyDetailFilter(payload.rows, nextDetailFilter));
  }
  useEffect(() => {
    let cancelled = false;
    restoreDashboardSession()
      .then((restored) => {
        if (cancelled || !restored) return;
        setUser(restored.user);
        setBootstrap(restored.bootstrap);
        setBookings(restored.bookings);
      })
      .catch((error) => {
        if (!cancelled) setSessionError(error.message || "Your session could not be restored.");
      })
      .finally(() => {
        if (!cancelled) setSessionReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const login = createLoginAction({
    setNotice,
    setUser,
    setBookingFilters,
    setBookingSearch,
    setActiveView,
    loadBootstrap,
    setBookings
  });
  const navigate = createNavigationAction({
    detailFilter,
    bookingFilters,
    setActiveView,
    setDetailFilter,
    setBookingPage,
    setExcelPage,
    setNotice,
    setBookingUploadModalOpen,
    loadBookings
  });
  const {
    changeBookingFilters,
    updateExcelFilters,
    clearBookingFilters,
    previewBookingFile,
    loadSampleBookingUpload,
    removeBookingUpload,
    submitBookingUpload,
    saveArea,
    saveRegional,
    changeAreaField,
    updateLookupOption,
    addLookupOption,
    closeAddOptionModal
  } = createBookingActions({
    bookingFilters,
    setBookingFilters,
    setBookingPage,
    setExcelPage,
    loadBookings,
    detailFilter,
    setExcelFilters,
    setDetailFilter,
    setBookingSearch,
    loadBootstrap,
    setNotice,
    setUploadPreview,
    setPendingBookingUpload,
    pendingBookingUpload,
    setBookingUploadModalOpen,
    canAreaEdit,
    setSelectedBooking,
    selectedBooking,
    user,
    canRegionalEdit,
    setSelectedAreaField,
    setAreaOptionSearch,
    setAreaOptionStatus,
    setEditingOptionId,
    setOptionDraft,
    selectedAreaField,
    setAddOptionError,
    setAddOptionModalOpen,
    setRegionDependencyConflict
  });
  const metrics = useMemo(() => buildDashboardMetrics(bookings), [bookings]);
  const dashboardInsights = useMemo(() => buildDashboardInsights(bookings, canAdmin), [bookings, canAdmin]);
  const { adminUsers, emailCampaigns, emailTemplates, onboardingWorkflows, effectiveBootstrap } =
    useDashboardCollections({
      user,
      activeView,
      userTable,
      userPage,
      setUserPage,
      bootstrap,
      onboardingOpen: bulkUserModalOpen
    });
  const { updateUserFilters, sortUsers, userUpdated, downloadUsers, createSingleUser, changeSingleUserRole } =
    createUserActions({
      setUserTable,
      setUserPage,
      updateUserRecord: adminUsers.updateUser,
      loadAllUsers: adminUsers.loadAll,
      reloadUsers: adminUsers.reload,
      setNotice,
      bootstrap: effectiveBootstrap,
      setSingleUserErrors,
      loadBootstrap,
      setSingleUserModalOpen,
      setOnboardingWorkflowId,
      setBulkUserModalOpen,
      bulkUserModalOpen,
      onboardingWorkflowId,
      setActiveView,
      setSingleUserRole
    });
  const {
    logout,
    passwordChanged,
    profilePhotoSaved,
    openNotification,
    metricClick,
    handleDownloadBookings,
    confirmAbortWorkflow
  } = createShellActions({
    setUser,
    setBootstrap,
    setBookings,
    setActiveView,
    setBookingFilters,
    setBookingSearch,
    setNotice,
    setNotifications: notificationState.setNotifications,
    setNotificationCount: notificationState.setNotificationCount,
    setNotificationDrawerOpen: notificationState.setDrawerOpen,
    setBookingUploadModalOpen,
    setBookingWorkspaceView,
    setChangePasswordOpen,
    setProfilePhotoOpen,
    user,
    setDetailFilter,
    setSelectedBooking,
    setBookingPage,
    loadBookings,
    bookingFilters,
    bookings,
    setAbortingWorkflow,
    abortWorkflow,
    loadBootstrap,
    setAbortWorkflow
  });
  if (!sessionReady || sessionError || !user) {
    return { sessionReady, sessionError, user, notice, login };
  }
  return buildDashboardViewModel({
    sessionReady,
    sessionError,
    user,
    notice,
    login,
    activeView,
    canAdmin,
    notifications: notificationState.notifications,
    notificationCount: notificationState.notificationCount,
    notificationCollection: notificationState.collection,
    notificationDrawerOpen: notificationState.drawerOpen,
    navigate,
    metricClick,
    setSelectedBooking,
    setNotificationDrawerOpen: notificationState.setDrawerOpen,
    setProfilePhotoOpen,
    setChangePasswordOpen,
    setNotice,
    logout,
    metrics,
    dashboardInsights,
    bookings,
    detailFilter,
    bookingWorkspaceView,
    setBookingWorkspaceView,
    handleDownloadBookings,
    setBookingUploadModalOpen,
    bookingPage,
    bookingSearch,
    bookingFilters,
    bootstrap: effectiveBootstrap,
    canAreaEdit,
    setBookingSearch,
    changeBookingFilters,
    clearBookingFilters,
    loadBookings,
    setBookingPage,
    excelFilters,
    excelPage,
    updateExcelFilters,
    setExcelPage,
    selectedAreaField,
    areaOptionSearch,
    areaOptionStatus,
    editingOptionId,
    optionDraft,
    changeAreaField,
    setAreaOptionSearch,
    setAreaOptionStatus,
    setEditingOptionId,
    setOptionDraft,
    updateLookupOption,
    setAddOptionError,
    setAddOptionModalOpen,
    setRegionDependencyConflict,
    filteredUsers: adminUsers.users,
    userTotal: adminUsers.pagination.total,
    usersLoading: adminUsers.loading,
    usersError: adminUsers.error,
    reloadUsers: adminUsers.reload,
    emailCampaigns,
    emailTemplates,
    onboardingWorkflows,
    userTable,
    userPage,
    setSingleUserRole,
    setSingleUserErrors,
    setSingleUserModalOpen,
    setOnboardingWorkflowId,
    setBulkUserModalOpen,
    bulkUserModalOpen,
    onboardingWorkflowId,
    setActiveView,
    setAbortWorkflow,
    downloadUsers,
    updateUserFilters,
    sortUsers,
    userUpdated,
    setUserPage,
    preferredOnboardingTemplateId,
    templateReturnWorkflowId,
    setTemplateReturnWorkflowId,
    setPreferredOnboardingTemplateId,
    loadBootstrap,
    changePasswordOpen,
    profilePhotoOpen,
    singleUserModalOpen,
    singleUserRole,
    singleUserErrors,
    selectedBooking,
    canRegionalEdit,
    addOptionModalOpen,
    addOptionError,
    bookingUploadModalOpen,
    uploadPreview,
    pendingBookingUpload,
    abortWorkflow,
    abortingWorkflow,
    regionDependencyConflict,
    setRegionDependencyConflict,
    passwordChanged,
    profilePhotoSaved,
    changeSingleUserRole,
    createSingleUser,
    saveArea,
    saveRegional,
    closeAddOptionModal,
    addLookupOption,
    previewBookingFile,
    loadSampleBookingUpload,
    removeBookingUpload,
    submitBookingUpload,
    openNotification,
    confirmAbortWorkflow
  });
}
