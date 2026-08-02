import { scopeBookingsForUser } from "./access.js";

const fieldLabels = {
  bookingCategory: "Booking Category",
  wholesalesFeedback: "Wholesales Feedback",
  wsPlanning: "WS Planning",
  expectedRetailDate: "Expected Retail Date",
  cancellationReason: "Cancellation Reason",
  wholesaleInput: "Wholesale Input",
  retailInput: "Retail Input"
};

export function changedNotificationFields(previous = {}, next = {}, keys = []) {
  return keys.filter((key) => String(previous[key] || "") !== String(next[key] || ""));
}

export function createBookingUpdateNotification(db, { booking, actor, changedFields }) {
  if (!changedFields.length) return null;
  const recipientUserIds = db.users.filter((user) => user.role === "Admin" && user.status === "active").map((user) => user.id);
  if (!recipientUserIds.length) return null;

  const notification = {
    id: `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType: actor.role === "Area Manager" ? "area_inputs_updated" : "regional_inputs_updated",
    bookingId: booking.id,
    salesOrderId: booking.salesOrderId,
    dealerCode: booking.dealerCode,
    actorUserId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    title: `${actor.role} updated a booking`,
    message: `${actor.name} updated ${booking.salesOrderId}.`,
    changedFields: changedFields.map((field) => ({ key: field, label: fieldLabels[field] || field })),
    recipientUserIds,
    readByUserIds: [],
    createdAt: new Date().toISOString()
  };
  db.notifications.unshift(notification);
  return notification;
}

export function createBookingImportNotifications(db, { beforeBookings = [], importedSalesOrderIds = [], actor }) {
  const importedIds = new Set(importedSalesOrderIds.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean));
  const beforeBySalesOrder = new Map(beforeBookings.map((booking) => [String(booking.salesOrderId || "").toLowerCase(), booking]));
  const notifications = [];

  for (const booking of db.bookings.filter((item) => importedIds.has(String(item.salesOrderId || "").toLowerCase()))) {
    const previous = beforeBySalesOrder.get(String(booking.salesOrderId || "").toLowerCase());
    const recipientUserIds = db.users
      .filter((user) => user.status === "active" && ["Area Manager", "Regional Manager"].includes(user.role))
      .filter((user) => scopeBookingsForUser([booking], user).length && (!previous || !scopeBookingsForUser([previous], user).length))
      .map((user) => user.id);
    if (!recipientUserIds.length) continue;

    notifications.push({
      id: `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      eventType: "booking_allocated",
      bookingId: booking.id,
      salesOrderId: booking.salesOrderId,
      dealerCode: booking.dealerCode,
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      title: `New booking allocated: ${booking.salesOrderId}`,
      message: `${booking.salesOrderId} was allocated to your booking scope from an Excel import.`,
      changedFields: [{ key: "allocation", label: "Excel allocation" }],
      recipientUserIds,
      readByUserIds: [],
      createdAt: new Date().toISOString()
    });
  }

  db.notifications.unshift(...notifications);
  return notifications;
}
export function unreadNotificationsForUser(db, userId) {
  return (db.notifications || [])
    .filter((notification) => notification.recipientUserIds.includes(userId) && !notification.readByUserIds.includes(userId))
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

export function markNotificationRead(db, notificationId, userId) {
  const notification = (db.notifications || []).find((item) => item.id === notificationId && item.recipientUserIds.includes(userId));
  if (!notification) return null;
  if (!notification.readByUserIds.includes(userId)) notification.readByUserIds.push(userId);
  return notification;
}
