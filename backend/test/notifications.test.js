import test from "node:test";
import assert from "node:assert/strict";
import {
  changedNotificationFields,
  createBookingUpdateNotification,
  createBookingImportNotifications,
  markNotificationRead,
  unreadNotificationsForUser
} from "../src/notifications.js";

function fixture() {
  return {
    users: [
      { id: "admin-1", name: "Admin One", role: "Admin", status: "active" },
      { id: "admin-2", name: "Admin Two", role: "Admin", status: "active" },
      { id: "admin-inactive", name: "Inactive Admin", role: "Admin", status: "inactive" }
    ],
    notifications: []
  };
}

test("detects only changed workflow fields", () => {
  const changed = changedNotificationFields(
    { bookingCategory: "Open", wsPlanning: "Pending" },
    { bookingCategory: "Open", wsPlanning: "Available" },
    ["bookingCategory", "wsPlanning"]
  );
  assert.deepEqual(changed, ["wsPlanning"]);
});

test("creates one unread notification for every active admin", () => {
  const db = fixture();
  const notification = createBookingUpdateNotification(db, {
    booking: { id: "booking-1", salesOrderId: "SOB10001", dealerCode: "DLR001" },
    actor: { id: "area-1", name: "Area Manager West", role: "Area Manager" },
    changedFields: ["bookingCategory", "wsPlanning"]
  });

  assert.equal(db.notifications.length, 1);
  assert.deepEqual(notification.recipientUserIds, ["admin-1", "admin-2"]);
  assert.deepEqual(notification.changedFields.map((field) => field.label), ["Booking Category", "WS Planning"]);
  assert.equal(unreadNotificationsForUser(db, "admin-1").length, 1);
  assert.equal(unreadNotificationsForUser(db, "admin-inactive").length, 0);
});

test("reading a notification is isolated to the selected admin", () => {
  const db = fixture();
  const notification = createBookingUpdateNotification(db, {
    booking: { id: "booking-1", salesOrderId: "SOB10001", dealerCode: "DLR001" },
    actor: { id: "regional-1", name: "Regional Manager West", role: "Regional Manager" },
    changedFields: ["retailInput"]
  });

  markNotificationRead(db, notification.id, "admin-1");
  assert.equal(unreadNotificationsForUser(db, "admin-1").length, 0);
  assert.equal(unreadNotificationsForUser(db, "admin-2").length, 1);
});

test("Excel import notifies only managers who newly gain booking access", () => {
  const db = fixture();
  db.users.push(
    { id: "area-new", name: "Area Manager New", role: "Area Manager", region: "West", status: "active" },
    { id: "area-old", name: "Area Manager Old", role: "Area Manager", region: "West", status: "active" },
    { id: "regional-west", name: "Regional West", role: "Regional Manager", region: "West", status: "active" },
    { id: "area-inactive", name: "Area Manager Inactive", role: "Area Manager", region: "West", status: "inactive" }
  );
  const beforeBookings = [
    {
      id: "booking-reassigned",
      salesOrderId: "SO-REASSIGNED",
      assignedAreaManagerId: "area-old",
      assignedRegionalManagerId: "regional-west",
      region: "West"
    }
  ];
  db.bookings = [
    {
      id: "booking-new",
      salesOrderId: "SO-NEW",
      dealerCode: "D1",
      assignedAreaManagerId: "area-new",
      assignedRegionalManagerId: "regional-west",
      region: "West"
    },
    {
      ...beforeBookings[0],
      assignedAreaManagerId: "area-new"
    }
  ];

  const notifications = createBookingImportNotifications(db, {
    beforeBookings,
    importedSalesOrderIds: ["SO-NEW", "SO-REASSIGNED"],
    actor: { id: "admin-1", name: "Admin One", role: "Admin" }
  });

  assert.equal(notifications.length, 2);
  assert.deepEqual(
    notifications.find((item) => item.salesOrderId === "SO-NEW").recipientUserIds,
    ["area-new", "regional-west"]
  );
  assert.deepEqual(
    notifications.find((item) => item.salesOrderId === "SO-REASSIGNED").recipientUserIds,
    ["area-new"]
  );
  assert.equal(unreadNotificationsForUser(db, "area-old").length, 0);
  assert.equal(unreadNotificationsForUser(db, "area-inactive").length, 0);
  assert.equal(unreadNotificationsForUser(db, "admin-1").length, 0);
});

test("re-importing an unchanged allocation does not duplicate notifications", () => {
  const db = fixture();
  const booking = {
    id: "booking-existing",
    salesOrderId: "SO-EXISTING",
    assignedAreaManagerId: "area-1",
    assignedRegionalManagerId: "regional-1",
    region: "West"
  };
  db.users.push({ id: "area-1", name: "Area One", role: "Area Manager", region: "West", status: "active" });
  db.bookings = [{ ...booking }];

  const notifications = createBookingImportNotifications(db, {
    beforeBookings: [{ ...booking }],
    importedSalesOrderIds: [booking.salesOrderId],
    actor: { id: "admin-1", name: "Admin One", role: "Admin" }
  });

  assert.deepEqual(notifications, []);
  assert.deepEqual(db.notifications, []);
});
test("does not create a notification when no workflow value changed", () => {
  const db = fixture();
  const notification = createBookingUpdateNotification(db, {
    booking: { id: "booking-1", salesOrderId: "SOB10001" },
    actor: { id: "area-1", name: "Area Manager West", role: "Area Manager" },
    changedFields: []
  });
  assert.equal(notification, null);
  assert.equal(db.notifications.length, 0);
});
