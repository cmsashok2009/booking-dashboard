"use client";

import AddLookupOptionModal from "../bookings/AddLookupOptionModal";
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
        roles={state.bootstrap?.roles || []}
        regions={state.bootstrap?.regions || []}
        roleDefinitions={state.bootstrap?.roleDefinitions || []}
        role={state.singleUserRole}
        errors={state.singleUserErrors}
        onRoleChange={actions.changeSingleUserRole}
        onClearError={actions.clearSingleUserError}
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
        fieldLabel={lookupFieldLabels[state.selectedAreaField]}
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
        onClose={actions.closeNotifications}
        onOpenNotification={actions.openNotification}
      />
      <ConfirmationModal
        open={Boolean(state.abortWorkflow)}
        eyebrow="Onboarding workflow"
        title="Abort this onboarding?"
        description="This workflow will be removed from onboarding in progress. Users already created and the complete audit history will be retained."
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
