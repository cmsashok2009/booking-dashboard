"use client";

import { useEffect, useState } from "react";
import BrandLogo from "../../components/BrandLogo";
import CloseButton from "../../components/ui/CloseButton";
import SideDrawer from "../../components/ui/SideDrawer";
import EmailDeliveryView from "../../components/EmailDeliveryView";
import EmailSettingsView from "../../components/EmailSettingsView";
import EmailTemplatesView from "../../components/EmailTemplatesView";
import FeatureErrorBoundary from "../../components/FeatureErrorBoundary";
import InsightBarChart from "../../components/InsightBarChart";
import ReconciliationDashboard from "../../components/ReconciliationDashboard";
import Topbar from "../../components/Topbar";
import { detailTitle } from "../../utils/bookings";
import { AreaFieldsWorkspace } from "../area-fields";
import { BookingWorkspace } from "../bookings";
import { UsersWorkspace } from "../users";
import DashboardMetrics from "./DashboardMetrics";
import DashboardNavigation from "./DashboardNavigation";

function PageTopbar({ title, subtitle, state, actions }) {
  return (
    <Topbar
      title={title}
      subtitle={subtitle}
      user={state.user}
      notice={state.notice}
      notificationCount={state.notifications.length}
      notificationsOpen={state.notificationDrawerOpen}
      onNotificationsClick={actions.openNotifications}
      onEditProfile={actions.openProfilePhoto}
      onChangePassword={actions.openChangePassword}
      onNoticeClose={actions.clearNotice}
      onLogout={actions.logout}
      onMenuClick={actions.openMobileNavigation}
    />
  );
}
export default function DashboardShell({ state, actions, models, overlays }) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const { activeView, user, canAdmin } = state;
  const shellActions = { ...actions, openMobileNavigation: () => setMobileNavigationOpen(true) };

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const desktop = window.matchMedia("(min-width: 901px)");
    const closeOnDesktop = (event) => event.matches && setMobileNavigationOpen(false);
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  function navigateFromDrawer(view) {
    setMobileNavigationOpen(false);
    actions.navigate(view);
  }

  return (
    <>
      <div className="shell">
        <aside className="sidebar">
          <BrandLogo compact inverse className="brand" />
          <DashboardNavigation activeView={activeView} canAdmin={canAdmin} onNavigate={actions.navigate} />
        </aside>
        <main className="main">
          {activeView === "dashboard" ? (
            <>
              <PageTopbar
                state={state}
                actions={shellActions}
                title="Dashboard"
                subtitle={
                  canAdmin
                    ? "Area-wise operational overview across all bookings."
                    : "Operational overview of your assigned bookings."
                }
              />
              <DashboardMetrics metrics={models.dashboard.metrics} onSelect={actions.selectMetric} />
              {canAdmin ? (
                <FeatureErrorBoundary name="Dashboard insights" resetKey={activeView}>
                  <div className="insights-grid">
                    {models.dashboard.insights.map((insight) => (
                      <InsightBarChart key={insight.title} {...insight} />
                    ))}
                  </div>
                </FeatureErrorBoundary>
              ) : null}
              <FeatureErrorBoundary name="Fulfillment overview" resetKey={activeView}>
                <ReconciliationDashboard
                  bookings={models.bookings.rows}
                  onOpenBooking={actions.openBooking}
                  mode={canAdmin ? "admin" : "manager"}
                  viewerRole={user.role}
                />
              </FeatureErrorBoundary>
            </>
          ) : null}
          {activeView === "bookings" ? (
            <>
              <PageTopbar
                state={state}
                actions={shellActions}
                title={detailTitle(models.bookings.detailFilter)}
                subtitle="Imported Excel fields are readonly; workflow fields are role based."
              />
              <BookingWorkspace {...models.bookings.workspace} />
            </>
          ) : null}
          {activeView === "area-fields" ? (
            <>
              <PageTopbar
                state={state}
                actions={shellActions}
                title="Area Fields"
                subtitle="Admin-managed content used by Area Manager booking updates."
              />
              <AreaFieldsWorkspace {...models.areaFields} />
            </>
          ) : null}
          {activeView === "users" ? (
            <>
              <PageTopbar
                state={state}
                actions={shellActions}
                title="Users"
                subtitle="Manage dashboard access and user assignments."
              />
              <UsersWorkspace {...models.users} />
            </>
          ) : null}
          {activeView === "email-templates" ? (
            <>
              <PageTopbar
                state={state}
                actions={shellActions}
                title="Email Templates"
                subtitle="Manage reusable messages for activation and future reminders."
              />
              <FeatureErrorBoundary name="Email templates" resetKey={activeView}>
                <EmailTemplatesView {...models.email.templates} />
              </FeatureErrorBoundary>
            </>
          ) : null}
          {activeView === "email-delivery" ? (
            <>
              <PageTopbar
                state={state}
                actions={shellActions}
                title="Email Delivery"
                subtitle="Review invitation campaigns and recipient delivery outcomes."
              />
              <FeatureErrorBoundary name="Email delivery" resetKey={activeView}>
                <EmailDeliveryView campaigns={models.email.campaigns} />
              </FeatureErrorBoundary>
            </>
          ) : null}
          {activeView === "email-settings" ? (
            <>
              <PageTopbar
                state={state}
                actions={shellActions}
                title="Email Settings"
                subtitle="Connect and verify the organization account used for activation delivery."
              />
              <FeatureErrorBoundary name="Email settings" resetKey={activeView}>
                <EmailSettingsView {...models.email.settings} />
              </FeatureErrorBoundary>
            </>
          ) : null}
        </main>
      </div>
      {mobileNavigationOpen ? (
        <SideDrawer
          className="mobile-nav-drawer"
          backdropClassName="mobile-nav-backdrop"
          labelledBy="mobile-navigation-title"
          onClose={() => setMobileNavigationOpen(false)}
        >
          <header className="mobile-nav-header">
            <BrandLogo compact inverse />
            <h2 id="mobile-navigation-title" className="visually-hidden">
              Main navigation
            </h2>
            <CloseButton onClick={() => setMobileNavigationOpen(false)} autoFocus />
          </header>
          <DashboardNavigation activeView={activeView} canAdmin={canAdmin} onNavigate={navigateFromDrawer} />
        </SideDrawer>
      ) : null}
      {overlays}
    </>
  );
}
