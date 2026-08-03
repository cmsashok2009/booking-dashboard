import { downloadBookingsExcel } from "../../utils/exportExcel";
import { request } from "../../utils/api";

const EMPTY_BOOKING_FILTERS = { search: "", region: "", wholesaleInput: "", retailInput: "" };

export function createNavigationAction({
  detailFilter,
  bookingFilters,
  setActiveView,
  setDetailFilter,
  setBookingPage,
  setExcelPage,
  setNotice,
  setBookingUploadModalOpen,
  loadBookings
}) {
  return async function navigate(view) {
    const nextDetail = ["dashboard", "bookings"].includes(view) ? "all" : detailFilter;
    setActiveView(view);
    setDetailFilter(nextDetail);
    setBookingPage(1);
    setExcelPage(1);
    setNotice(null);
    if (view !== "bookings") setBookingUploadModalOpen(false);
    if (!["dashboard", "bookings"].includes(view)) return;
    try {
      await loadBookings(bookingFilters, nextDetail);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.message || "Bookings could not be refreshed. Your current view has been preserved."
      });
    }
  };
}
export function createShellActions(context) {
  const {
    setUser,
    setBootstrap,
    setBookings,
    setActiveView,
    setBookingFilters,
    setBookingSearch,
    setNotice,
    setNotifications,
    setNotificationCount,
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
    setAbortWorkflow,
    updateUserRecord
  } = context;
  async function logout() {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } catch {
      /* Clear local state even if the session already expired. */
    }
    window.sessionStorage.removeItem("booking-dashboard-user");
    setUser(null);
    setBootstrap(null);
    setBookings([]);
    setActiveView("dashboard");
    setBookingFilters({ ...EMPTY_BOOKING_FILTERS });
    setBookingSearch("");
    setNotice(null);
    setNotifications([]);
    setNotificationCount?.(0);
    setNotificationDrawerOpen(false);
    setBookingUploadModalOpen(false);
    setBookingWorkspaceView("workflow");
  }

  function passwordChanged() {
    window.sessionStorage.removeItem("booking-dashboard-user");
    setChangePasswordOpen(false);
    setUser(null);
    setBootstrap(null);
    setBookings([]);
    setNotifications([]);
    setNotificationCount?.(0);
    setNotice({ type: "success", message: "Password changed successfully. Sign in with your new password." });
  }

  function profilePhotoSaved(updatedUser) {
    setUser(updatedUser);
    updateUserRecord?.(updatedUser);
    setBootstrap((current) =>
      current
        ? { ...current, users: current.users.map((item) => (item.id === updatedUser.id ? updatedUser : item)) }
        : current
    );
    window.sessionStorage.setItem("booking-dashboard-user", JSON.stringify(updatedUser));
    setProfilePhotoOpen(false);
    setNotice({ type: "success", message: "Profile photo updated." });
  }

  async function openNotification(notification) {
    try {
      const payload = await request(`/api/bookings/${encodeURIComponent(notification.bookingId)}`);
      const readResult = await request(`/api/notifications/${encodeURIComponent(notification.id)}/read`, {
        method: "PATCH"
      });
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      setNotificationCount?.(Number(readResult.unreadCount || 0));
      setBookings((current) => {
        const existing = current.some((booking) => booking.id === payload.booking.id);
        return existing
          ? current.map((booking) => (booking.id === payload.booking.id ? payload.booking : booking))
          : [payload.booking, ...current];
      });
      setDetailFilter("all");
      setActiveView("bookings");
      setBookingWorkspaceView("workflow");
      setSelectedBooking(payload.booking);
      setNotificationDrawerOpen(false);
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Unable to open this booking update." });
    }
  }
  async function metricClick(filter) {
    setDetailFilter(filter);
    setActiveView("bookings");
    setBookingWorkspaceView("workflow");
    setBookingPage(1);
    await loadBookings(bookingFilters, filter);
  }

  async function handleDownloadBookings() {
    try {
      await downloadBookingsExcel(bookings);
      setNotice({ type: "success", message: `${bookings.length} bookings downloaded.` });
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Unable to download bookings." });
    }
  }

  async function confirmAbortWorkflow() {
    setAbortingWorkflow(true);
    try {
      const result = await request(`/api/admin/onboarding/${encodeURIComponent(abortWorkflow.id)}/cancel`, {
        method: "POST"
      });
      setAbortWorkflow(null);
      const removed = result.removedUserCount || 0;
      setNotice({
        type: "success",
        message: removed
          ? `Onboarding aborted. ${removed} pending ${removed === 1 ? "user was" : "users were"} removed; audit history was retained.`
          : "Onboarding aborted. No pending users were removed; audit history was retained."
      });
      try {
        await loadBootstrap();
      } catch {
        setNotice({
          type: "warning",
          message:
            "Onboarding was aborted, but the workflow list could not be refreshed. Refresh the page to update the list."
        });
      }
    } catch (error) {
      setNotice({ type: "error", message: error.payload?.error || error.message });
    } finally {
      setAbortingWorkflow(false);
    }
  }
  return {
    logout,
    passwordChanged,
    profilePhotoSaved,
    openNotification,
    metricClick,
    handleDownloadBookings,
    confirmAbortWorkflow
  };
}
