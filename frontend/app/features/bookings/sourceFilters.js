import { readPath } from "../../utils/bookings.js";
import { excelColumns } from "../../constants/dashboard.js";

export function filterBookingSourceRows(bookings, filters) {
  const search = filters.search.trim().toLowerCase();
  return bookings.filter((booking) => {
    const matchesSearch =
      !search ||
      excelColumns.some(([key]) =>
        String(readPath(booking, key) || "")
          .toLowerCase()
          .includes(search)
      );
    const matchesRegion = !filters.region || booking.region === filters.region;
    const matchesWorkflow =
      !filters.workflow ||
      (filters.workflow === "area-updated" && Boolean(booking.areaInputs?.updatedAt)) ||
      (filters.workflow === "regional-updated" && Boolean(booking.regionalInputs?.updatedAt)) ||
      (filters.workflow === "pending" && (!booking.areaInputs?.updatedAt || !booking.regionalInputs?.updatedAt));
    return matchesSearch && matchesRegion && matchesWorkflow;
  });
}
