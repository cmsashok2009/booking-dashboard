export function buildDashboardViewModel(context) {
  const {
    sessionReady,
    sessionError,
    user,
    notice,
    login,
    activeView,
    canAdmin,
    notifications,
    notificationDrawerOpen,
    navigate,
    metricClick,
    setSelectedBooking,
    setNotificationDrawerOpen,
    setProfilePhotoOpen,
    setChangePasswordOpen,
    setNotice,
    logout,
    metrics,
    dashboardInsights,
    bookings,
    detailFilter,
    bookingWorkspaceView,
    setBookingWorkspaceView,
    handleDownloadBookings,
    setBookingUploadModalOpen,
    bookingPage,
    bookingSearch,
    bookingFilters,
    bootstrap,
    canAreaEdit,
    setBookingSearch,
    changeBookingFilters,
    clearBookingFilters,
    loadBookings,
    setBookingPage,
    excelFilters,
    excelPage,
    updateExcelFilters,
    setExcelPage,
    selectedAreaField,
    areaOptionSearch,
    areaOptionStatus,
    editingOptionId,
    optionDraft,
    changeAreaField,
    setAreaOptionSearch,
    setAreaOptionStatus,
    setEditingOptionId,
    setOptionDraft,
    updateLookupOption,
    setAddOptionError,
    setAddOptionModalOpen,
    filteredUsers,
    userTable,
    userPage,
    setSingleUserRole,
    setSingleUserErrors,
    setSingleUserModalOpen,
    setOnboardingWorkflowId,
    setBulkUserModalOpen,
    bulkUserModalOpen,
    onboardingWorkflowId,
    setActiveView,
    setAbortWorkflow,
    downloadUsers,
    updateUserFilters,
    sortUsers,
    userUpdated,
    setUserPage,
    preferredOnboardingTemplateId,
    templateReturnWorkflowId,
    setTemplateReturnWorkflowId,
    setPreferredOnboardingTemplateId,
    loadBootstrap,
    changePasswordOpen,
    profilePhotoOpen,
    singleUserModalOpen,
    singleUserRole,
    singleUserErrors,
    selectedBooking,
    canRegionalEdit,
    addOptionModalOpen,
    addOptionError,
    bookingUploadModalOpen,
    uploadPreview,
    pendingBookingUpload,
    abortWorkflow,
    abortingWorkflow,
    passwordChanged,
    profilePhotoSaved,
    changeSingleUserRole,
    createSingleUser,
    saveArea,
    saveRegional,
    closeAddOptionModal,
    addLookupOption,
    previewBookingFile,
    loadSampleBookingUpload,
    removeBookingUpload,
    submitBookingUpload,
    openNotification,
    confirmAbortWorkflow
  } = context;
  const shellState = {
    activeView,
    user,
    canAdmin,
    notice,
    notifications,
    notificationDrawerOpen
  };
  const shellActions = {
    navigate,
    selectMetric: metricClick,
    openBooking: setSelectedBooking,
    openNotifications: () => setNotificationDrawerOpen(true),
    openProfilePhoto: () => setProfilePhotoOpen(true),
    openChangePassword: () => setChangePasswordOpen(true),
    clearNotice: () => setNotice(null),
    logout
  };
  const models = {
    dashboard: { metrics, insights: dashboardInsights },
    bookings: {
      rows: bookings,
      detailFilter,
      workspace: {
        view: bookingWorkspaceView,
        canAdmin,
        onViewChange: setBookingWorkspaceView,
        onDownload: handleDownloadBookings,
        onOpenUpload: () => setBookingUploadModalOpen(true),
        workflow: {
          detailFilter,
          bookings,
          page: bookingPage,
          search: bookingSearch,
          filters: bookingFilters,
          regions: bootstrap?.regions || [],
          hideRegionFilter: canAreaEdit,
          onSearchChange: setBookingSearch,
          onFilterChange: changeBookingFilters,
          onClear: clearBookingFilters,
          onRefresh: () => loadBookings(),
          onOpenBooking: setSelectedBooking,
          onPageChange: setBookingPage
        },
        source: {
          bookings,
          filters: excelFilters,
          page: excelPage,
          regions: bootstrap?.regions || [],
          onFilterChange: updateExcelFilters,
          onPageChange: setExcelPage
        }
      }
    },
    areaFields: {
      selectedField: selectedAreaField,
      options: bootstrap?.lookupOptions?.[selectedAreaField] || [],
      search: areaOptionSearch,
      status: areaOptionStatus,
      editingId: editingOptionId,
      draft: optionDraft,
      onFieldChange: changeAreaField,
      onSearchChange: setAreaOptionSearch,
      onStatusChange: setAreaOptionStatus,
      onStartEdit: (option) => {
        setEditingOptionId(option.id);
        setOptionDraft(option.label);
      },
      onDraftChange: setOptionDraft,
      onCancelEdit: () => {
        setEditingOptionId(null);
        setOptionDraft("");
      },
      onUpdateOption: updateLookupOption,
      onOpenAdd: () => {
        setAddOptionError("");
        setAddOptionModalOpen(true);
      }
    },
    users: {
      activeView,
      user,
      users: bootstrap?.users || [],
      filteredUsers,
      filters: userTable,
      page: userPage,
      roles: bootstrap?.roles || [],
      regions: bootstrap?.regions || [],
      workflows: bootstrap?.onboardingWorkflows || [],
      onAddSingle: () => {
        setSingleUserRole("");
        setSingleUserErrors({});
        setSingleUserModalOpen(true);
      },
      onAddBulk: () => {
        setOnboardingWorkflowId("");
        setBulkUserModalOpen(true);
      },
      onAbortWorkflow: setAbortWorkflow,
      onContinueWorkflow: (workflow) => {
        setOnboardingWorkflowId(workflow.id);
        setBulkUserModalOpen(true);
      },
      onDownload: downloadUsers,
      onFilterChange: updateUserFilters,
      onSort: sortUsers,
      onUserUpdated: userUpdated,
      onPageChange: setUserPage,
      onboarding: {
        open: bulkUserModalOpen,
        workflowId: onboardingWorkflowId,
        preferredTemplateId: preferredOnboardingTemplateId,
        templates: bootstrap?.emailTemplates || [],
        onClose: () => setBulkUserModalOpen(false),
        onUpdated: loadBootstrap,
        onCreateTemplate: (workflowId) => {
          setOnboardingWorkflowId(workflowId);
          setTemplateReturnWorkflowId(workflowId);
          setBulkUserModalOpen(false);
          navigate("email-templates");
        },
        setNotice
      }
    },
    email: {
      templates: {
        user,
        samples: bootstrap?.emailTemplateSamples || [],
        templates: bootstrap?.emailTemplates || [],
        returnWorkflowId: templateReturnWorkflowId,
        onReload: loadBootstrap,
        onReturnToOnboarding: (template) => {
          if (template) setNotice({ type: "success", message: `${template.name} is ready for this onboarding batch.` });
          setPreferredOnboardingTemplateId(template?.id || "");
          setActiveView("users");
          setOnboardingWorkflowId(templateReturnWorkflowId);
          setTemplateReturnWorkflowId("");
          setBulkUserModalOpen(true);
        },
        setNotice
      },
      campaigns: bootstrap?.emailCampaigns || [],
      settings: { provider: bootstrap?.emailProvider, user, onReload: loadBootstrap, setNotice }
    }
  };
  const overlayState = {
    changePasswordOpen,
    profilePhotoOpen,
    user,
    bootstrap,
    singleUserModalOpen,
    singleUserRole,
    singleUserErrors,
    selectedBooking,
    canAreaEdit,
    canRegionalEdit,
    addOptionModalOpen,
    selectedAreaField,
    addOptionError,
    bookingUploadModalOpen,
    uploadPreview,
    pendingBookingUpload,
    notificationDrawerOpen,
    notifications,
    abortWorkflow,
    abortingWorkflow
  };
  const overlayActions = {
    closeChangePassword: () => setChangePasswordOpen(false),
    passwordChanged,
    closeProfilePhoto: () => setProfilePhotoOpen(false),
    profilePhotoSaved,
    changeSingleUserRole,
    clearSingleUserError: (name) => setSingleUserErrors((current) => ({ ...current, [name]: undefined })),
    closeSingleUser: () => setSingleUserModalOpen(false),
    createSingleUser,
    closeBookingDetails: () => setSelectedBooking(null),
    saveArea,
    saveRegional,
    clearAddOptionError: () => addOptionError && setAddOptionError(""),
    closeAddOption: closeAddOptionModal,
    addLookupOption,
    previewBookingFile,
    closeBookingUpload: () => setBookingUploadModalOpen(false),
    loadSampleBookingUpload,
    removeBookingUpload,
    submitBookingUpload,
    closeNotifications: () => setNotificationDrawerOpen(false),
    openNotification,
    closeAbortWorkflow: () => setAbortWorkflow(null),
    confirmAbortWorkflow
  };

  return {
    sessionReady,
    sessionError,
    user,
    notice,
    login,
    shellState,
    shellActions,
    models,
    overlayState,
    overlayActions
  };
}
