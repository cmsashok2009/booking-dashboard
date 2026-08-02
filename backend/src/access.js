export function normalizeManagerName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\barea\s+manager\b/g, "am")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function isBookingAssignedToAreaManager(booking, user) {
  if (!booking || !user) return false;

  if (booking.assignedAreaManagerId) return booking.assignedAreaManagerId === user.id;

  const bookingManagerName = normalizeManagerName(booking.amNameFromFile);
  const userManagerName = normalizeManagerName(user.name);
  return Boolean(bookingManagerName && userManagerName && bookingManagerName === userManagerName);
}

const NATIONAL_ROLES = new Set(["Admin", "All India I", "All India II", "All India"]);

export function scopeBookingsForUser(bookings, user) {
  if (!user || user.status !== "active") return [];
  if (NATIONAL_ROLES.has(user.role)) return [...bookings];
  if (user.role === "Area Manager") return bookings.filter((booking) => isBookingAssignedToAreaManager(booking, user));
  if (user.role === "Regional Manager") {
    return bookings.filter((booking) => booking.assignedRegionalManagerId === user.id && booking.region === user.region);
  }
  return [];
}
