import { request } from "../../utils/api";

export default async function loadDashboardBookings(user, filters) {
  const params = new URLSearchParams({
    role: user?.role || "",
    userId: user?.id || "",
    search: filters.search,
    region: filters.region,
    wholesaleInput: filters.wholesaleInput,
    retailInput: filters.retailInput
  });
  return request(`/api/bookings?${params}`);
}
