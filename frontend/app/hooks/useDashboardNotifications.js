"use client";

import { useState } from "react";
import useNotificationStream from "./useNotificationStream";

export default function useDashboardNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const collection = useNotificationStream(userId, setNotifications, setNotificationCount);

  return {
    notifications,
    setNotifications,
    notificationCount,
    setNotificationCount,
    drawerOpen,
    setDrawerOpen,
    collection
  };
}
