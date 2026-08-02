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
import EmailManagementTabs, { EMAIL_MANAGEMENT_VIEWS } from "./EmailManagementTabs";
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
                title="Business Settings"
                subtitle="Manage regions, dealer codes, and booking workflow options."
              />
              <AreaFieldsWorkspace {...models.areaFields} />
            </>
          ) : null}
          {activeView === "users" ? (
            <>
              <PageTopbar
                state={state}
                actions={shellActions}
                title="User Management"
                subtitle="Manage dashboard access and user assignments."
              />
              <UsersWorkspace {...models.users} />
            </>
          ) : null}
          {EMAIL_MANAGEMENT_VIEWS.includes(activeView) ? (
            <>
              <PageTopbar
                state={state}
                actions={shellActions}
                title="Email Management"
                subtitle="Manage message templates, delivery activity, and sender configuration."
              />
              <EmailManagementTabs activeView={activeView} onNavigate={actions.navigate}>
                {activeView === "email-templates" ? (
                  <FeatureErrorBoundary name="Email templates" resetKey={activeView}>
                    <EmailTemplatesView {...models.email.templates} />
                  </FeatureErrorBoundary>
                ) : null}
                {activeView === "email-delivery" ? (
                  <FeatureErrorBoundary name="Email delivery" resetKey={activeView}>
                    <EmailDeliveryView campaigns={models.email.campaigns} />
                  </FeatureErrorBoundary>
                ) : null}
                {activeView === "email-settings" ? (
                  <FeatureErrorBoundary name="Email settings" resetKey={activeView}>
                    <EmailSettingsView {...models.email.settings} />
                  </FeatureErrorBoundary>
                ) : null}
              </EmailManagementTabs>
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
