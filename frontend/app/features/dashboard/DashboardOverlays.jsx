"use client";

import AddLookupOptionModal from "../bookings/AddLookupOptionModal";
import { BlockingDependencyModal } from "../../components/ui";
import { BookingDetailsDrawer, BookingImportModal } from "../bookings";
import { SingleUserModal } from "../users";
import ChangePasswordModal from "../../components/ChangePasswordModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import NotificationDrawer from "../../components/NotificationDrawer";
import ProfilePhotoModal from "../../components/ProfilePhotoModal";
import { lookupFieldLabels } from "../../constants/dashboard";

export default function DashboardOverlays({ state, actions }) {
  return (
    <>
      <ChangePasswordModal
        open={state.changePasswordOpen}
        onClose={actions.closeChangePassword}
        onComplete={actions.passwordChanged}
      />
      <ProfilePhotoModal
        open={state.profilePhotoOpen}
        user={state.user}
        onClose={actions.closeProfilePhoto}
        onSaved={actions.profilePhotoSaved}
      />
      <SingleUserModal
        open={state.singleUserModalOpen}
        roles={(state.bootstrap?.roleDefinitions || []).map((role) => role.name)}
        regions={state.bootstrap?.regions || []}
        dealerCodes={state.bootstrap?.dealerCodes || []}
        roleDefinitions={state.bootstrap?.roleDefinitions || []}
        role={state.singleUserRole}
        errors={state.singleUserErrors}
        onRoleChange={actions.changeSingleUserRole}
        onClearError={actions.clearSingleUserError}
        onDataChanged={actions.refreshAccessMasterData}
        onClose={actions.closeSingleUser}
        onSubmit={actions.createSingleUser}
      />
      <BookingDetailsDrawer
        booking={state.selectedBooking}
        lookups={state.bootstrap?.lookups}
        role={state.user.role}
        canEditArea={state.canAreaEdit}
        canEditRegional={state.canRegionalEdit}
        onClose={actions.closeBookingDetails}
        onSaveArea={actions.saveArea}
        onSaveRegional={actions.saveRegional}
      />
      <AddLookupOptionModal
        open={state.addOptionModalOpen}
        fieldCode={state.selectedAreaField}
        fieldLabel={lookupFieldLabels[state.selectedAreaField]}
        regions={state.bootstrap?.regions || []}
        error={state.addOptionError}
        onClearError={actions.clearAddOptionError}
        onClose={actions.closeAddOption}
        onSubmit={actions.addLookupOption}
      />
      <BookingImportModal
        open={state.bookingUploadModalOpen}
        preview={state.uploadPreview}
        pendingUpload={state.pendingBookingUpload}
        onChooseFile={actions.previewBookingFile}
        onClose={actions.closeBookingUpload}
        onLoadSample={actions.loadSampleBookingUpload}
        onRemoveFile={actions.removeBookingUpload}
        onUpload={actions.submitBookingUpload}
      />
      <NotificationDrawer
        open={state.notificationDrawerOpen}
        notifications={state.notifications}
        unreadCount={state.notificationCount}
        pagination={state.notificationCollection?.pagination}
        loading={state.notificationCollection?.loading}
        loadingMore={state.notificationCollection?.loadingMore}
        error={state.notificationCollection?.error}
        onRetry={actions.retryNotifications}
        onLoadMore={actions.loadMoreNotifications}
        onClose={actions.closeNotifications}
        onOpenNotification={actions.openNotification}
      />
      <BlockingDependencyModal
        open={Boolean(state.regionDependencyConflict)}
        eyebrow="Region dependency"
        title="Region cannot be deactivated"
        description="This Region still has active Dealer Codes. Review those assignments, then deactivate or move each active Dealer Code before trying again."
        detailLabel="Region"
        detailValue={state.regionDependencyConflict?.regionName}
        actionLabel="View Dealer Codes"
        onClose={actions.closeRegionDependencyConflict}
        onAction={actions.viewRegionDealerCodes}
      />
      <ConfirmationModal
        open={Boolean(state.abortWorkflow)}
        eyebrow="Onboarding workflow"
        title="Abort this onboarding?"
        description="This workflow will be removed from onboarding in progress. Pending users created by this workflow will also be removed from Current Users. Audit history will be retained."
        detailLabel="Workflow"
        detailValue={state.abortWorkflow?.fileName || "User upload"}
        confirmLabel="Abort onboarding"
        cancelLabel="Keep onboarding"
        tone="danger"
        busy={state.abortingWorkflow}
        onClose={actions.closeAbortWorkflow}
        onConfirm={actions.confirmAbortWorkflow}
      />
    </>
  );
}
