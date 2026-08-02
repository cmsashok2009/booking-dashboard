"use client";

import { useEffect, useMemo, useState } from "react";
import { buildDashboardInsights, buildDashboardMetrics } from "../features/dashboard/selectors";
import { buildDashboardViewModel } from "../features/dashboard/viewModel";
import { createShellActions } from "../features/dashboard/controllerActions";
import { createLoginAction, restoreDashboardSession } from "../features/dashboard/sessionActions";
import { filterAndSortUsers } from "../features/users/selectors";
import { createUserActions } from "../features/users/controllerActions";
import { applyDetailFilter } from "../utils/bookings";
import { request } from "../utils/api";
import { createBookingActions } from "../features/bookings/controllerActions";

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
  const [notifications, setNotifications] = useState([]);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
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

  const canAdmin = user?.role === "Admin";
  const canAreaEdit = user?.role === "Area Manager";
  const canRegionalEdit = user?.role === "Regional Manager";
  async function loadBootstrap() {
    const payload = await request("/api/bootstrap");
    setBootstrap(payload);
    return payload;
  }

  async function loadBookings(nextFilters = bookingFilters, nextDetailFilter = detailFilter) {
    const params = new URLSearchParams({
      role: user?.role || "",
      userId: user?.id || "",
      search: nextFilters.search,
      region: nextFilters.region,
      wholesaleInput: nextFilters.wholesaleInput,
      retailInput: nextFilters.retailInput
    });
    const payload = await request(`/api/bookings?${params}`);
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
  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return undefined;
    }

    let cancelled = false;
    request("/api/notifications")
      .then((payload) => {
        if (!cancelled) setNotifications(payload.notifications || []);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      });

    if (typeof EventSource === "undefined") {
      return () => {
        cancelled = true;
      };
    }

    const stream = new EventSource("/api/notifications/stream");
    stream.onmessage = (event) => {
      if (cancelled) return;
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "snapshot") {
          setNotifications(payload.notifications || []);
        } else if (payload.type === "notification" && payload.notification) {
          setNotifications((current) =>
            current.some((item) => item.id === payload.notification.id) ? current : [payload.notification, ...current]
          );
        }
      } catch {
        /* Ignore malformed stream events and retain the current notification state. */
      }
    };

    return () => {
      cancelled = true;
      stream.close();
    };
  }, [user?.id]);
  const login = createLoginAction({
    setNotice,
    setUser,
    setBookingFilters,
    setBookingSearch,
    setActiveView,
    loadBootstrap,
    setBookings
  });
  async function navigate(view) {
    const nextDetail = ["dashboard", "bookings"].includes(view) ? "all" : detailFilter;
    setActiveView(view);
    setDetailFilter(nextDetail);
    setBookingPage(1);
    setExcelPage(1);
    setNotice(null);
    if (view !== "bookings") setBookingUploadModalOpen(false);
    if (["dashboard", "bookings"].includes(view)) {
      try {
        await loadBookings(bookingFilters, nextDetail);
      } catch (error) {
        setNotice({
          type: "error",
          message: error.message || "Bookings could not be refreshed. Your current view has been preserved."
        });
      }
    }
  }

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
    setBootstrap,
    setAddOptionError,
    setAddOptionModalOpen
  });
  const metrics = useMemo(() => buildDashboardMetrics(bookings), [bookings]);

  const dashboardInsights = useMemo(() => buildDashboardInsights(bookings, canAdmin), [bookings, canAdmin]);

  const filteredUsers = useMemo(
    () => filterAndSortUsers(bootstrap?.users || [], userTable),
    [bootstrap?.users, userTable]
  );

  const { updateUserFilters, sortUsers, userUpdated, downloadUsers, createSingleUser, changeSingleUserRole } =
    createUserActions({
      setUserTable,
      setUserPage,
      setBootstrap,
      filteredUsers,
      setNotice,
      bootstrap,
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
    setNotifications,
    setNotificationDrawerOpen,
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
    notifications,
    notificationDrawerOpen,
    navigate,
    metricClick,
    setSelectedBooking,
    setNotificationDrawerOpen,
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
    bootstrap,
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
    filteredUsers,
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
