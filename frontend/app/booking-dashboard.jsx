"use client";

import dynamic from "next/dynamic";
import Login from "./components/Login";
import ErrorState from "./components/ui/ErrorState";
import LoadingState from "./components/ui/LoadingState";
import DashboardShell from "./features/dashboard/DashboardShell";
import useDashboardController from "./hooks/useDashboardController";

const DashboardOverlays = dynamic(() => import("./features/dashboard/DashboardOverlays"), { ssr: false });

export default function BookingDashboard() {
  const controller = useDashboardController();

  if (!controller.sessionReady) {
    return (
      <main className="app-state-page">
        <LoadingState
          title="Restoring your session"
          description="Loading your access and latest booking information."
        />
      </main>
    );
  }
  if (controller.sessionError) {
    return (
      <main className="app-state-page">
        <ErrorState
          title="Dashboard connection unavailable"
          description={controller.sessionError}
          onRetry={() => window.location.reload()}
        />
      </main>
    );
  }
  if (!controller.user) return <Login notice={controller.notice} onLogin={controller.login} />;

  return (
    <DashboardShell
      state={controller.shellState}
      actions={controller.shellActions}
      models={controller.models}
      overlays={<DashboardOverlays state={controller.overlayState} actions={controller.overlayActions} />}
    />
  );
}
