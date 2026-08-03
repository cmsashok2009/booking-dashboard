"use client";

import useAdminUsers from "./useAdminUsers";
import useEmailCampaigns from "./useEmailCampaigns";
import useEmailTemplates from "./useEmailTemplates";
import useOnboardingWorkflows from "./useOnboardingWorkflows";
import useReferenceData from "./useReferenceData";

export default function useDashboardCollections({
  user,
  activeView,
  userTable,
  userPage,
  setUserPage,
  bootstrap,
  onboardingOpen
}) {
  const referenceData = useReferenceData(user, Boolean(bootstrap), bootstrap);

  return {
    adminUsers: useAdminUsers(user, userTable, userPage, setUserPage),
    emailCampaigns: useEmailCampaigns(user, activeView === "email-delivery"),
    emailTemplates: useEmailTemplates(
      user,
      activeView === "email-templates",
      bootstrap?.emailTemplates || [],
      onboardingOpen || activeView === "email-templates"
    ),
    onboardingWorkflows: useOnboardingWorkflows(user, activeView === "users" || onboardingOpen, []),
    effectiveBootstrap: referenceData.data || bootstrap
  };
}
