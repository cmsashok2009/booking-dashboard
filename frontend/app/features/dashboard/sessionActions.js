import { request } from "../../utils/api";
import { formValues } from "../../utils/forms";

const EMPTY_BOOKING_FILTERS = { search: "", region: "", wholesaleInput: "", retailInput: "" };

export function createLoginAction(context) {
  const { setNotice, setUser, setBookingFilters, setBookingSearch, setActiveView, loadBootstrap, setBookings } =
    context;
  async function login(event) {
    event.preventDefault();
    const form = formValues(event.currentTarget);
    setNotice({ message: "Logging in...", type: "info" });
    try {
      const payload = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.email, password: form.password })
      });
      setUser(payload.user);
      setBookingFilters({ ...EMPTY_BOOKING_FILTERS });
      setBookingSearch("");
      window.sessionStorage.setItem("booking-dashboard-user", JSON.stringify(payload.user));
      setActiveView("dashboard");
      setNotice(null);
      await loadBootstrap();
      const params = new URLSearchParams({
        role: payload.user.role,
        userId: payload.user.id,
        search: "",
        region: "",
        wholesaleInput: "",
        retailInput: ""
      });
      const bookingPayload = await request(`/api/bookings?${params}`);
      setBookings(bookingPayload.rows);
    } catch (error) {
      const authenticationFailed = /invalid credentials|invalid email or password/i.test(String(error.message || ""));
      setNotice({
        message: authenticationFailed
          ? "Email or password is incorrect."
          : "We could not sign you in. Please try again.",
        type: "error"
      });
    }
  }
  return login;
}
export async function restoreDashboardSession() {
  const cached = window.sessionStorage.getItem("booking-dashboard-user");
  if (!cached) return null;
  const cachedUser = JSON.parse(cached);
  if (!cachedUser?.id || !cachedUser?.role) {
    window.sessionStorage.removeItem("booking-dashboard-user");
    return null;
  }

  try {
    const bootstrap = await request("/api/bootstrap");
    const user = bootstrap.currentUser;
    if (!user?.id || !user?.role) {
      window.sessionStorage.removeItem("booking-dashboard-user");
      return null;
    }
    window.sessionStorage.setItem("booking-dashboard-user", JSON.stringify(user));
    const params = new URLSearchParams({
      role: user.role,
      userId: user.id,
      search: "",
      region: "",
      wholesaleInput: "",
      retailInput: ""
    });
    const bookingPayload = await request(`/api/bookings?${params}`);
    return { user, bootstrap, bookings: bookingPayload.rows };
  } catch (error) {
    if (error?.status === 401) {
      window.sessionStorage.removeItem("booking-dashboard-user");
      return null;
    }
    throw error;
  }
}
