import { lookupFieldLabels } from "../../constants/dashboard";
import { parseCsvPreview } from "../../utils/csv";
import { formValues } from "../../utils/forms";
import { request, requestText } from "../../utils/api";

const EMPTY_BOOKING_FILTERS = { search: "", region: "", wholesaleInput: "", retailInput: "" };

export function createBookingActions(context) {
  const {
    bookingFilters,
    setBookingFilters,
    setBookingPage,
    setExcelPage,
    loadBookings,
    detailFilter,
    setExcelFilters,
    setDetailFilter,
    setBookingSearch,
    loadBootstrap,
    setNotice,
    setUploadPreview,
    setPendingBookingUpload,
    pendingBookingUpload,
    setBookingUploadModalOpen,
    canAreaEdit,
    setSelectedBooking,
    selectedBooking,
    user,
    canRegionalEdit,
    setSelectedAreaField,
    setAreaOptionSearch,
    setAreaOptionStatus,
    setEditingOptionId,
    setOptionDraft,
    selectedAreaField,
    setBootstrap,
    setAddOptionError,
    setAddOptionModalOpen
  } = context;
  async function changeBookingFilters(patch) {
    const nextFilters = { ...bookingFilters, ...patch };
    setBookingFilters(nextFilters);
    setBookingPage(1);
    setExcelPage(1);
    await loadBookings(nextFilters, detailFilter);
  }

  function updateExcelFilters(patch) {
    setExcelFilters((current) => ({ ...current, ...patch }));
    setExcelPage(1);
  }
  async function clearBookingFilters() {
    setBookingFilters({ ...EMPTY_BOOKING_FILTERS });
    setBookingSearch("");
    setBookingPage(1);
    await loadBookings(EMPTY_BOOKING_FILTERS, "all");
    setDetailFilter("all");
  }
  async function uploadContent(endpoint, fileName, content) {
    try {
      const result = await request(endpoint, { method: "POST", body: JSON.stringify({ fileName, content }) });
      await loadBootstrap();
      await loadBookings();
      setNotice({
        message: `${result.originalFileName}: ${result.status}. Inserted ${result.insertedRows}, updated ${result.updatedRows}, failed ${result.failedRows}.`,
        type: "success"
      });
      return true;
    } catch (error) {
      const details = error.payload?.errors
        ?.slice(0, 4)
        .map((item) => `${item.columnName}: ${item.errorMessage}`)
        .join("; ");
      setNotice({ message: details || error.message, type: "error" });
      return false;
    }
  }

  async function previewBookingFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setUploadPreview({ fileName: file.name, ...parseCsvPreview(content) });
    setPendingBookingUpload({ fileName: file.name, content });
    setNotice({
      message: "Booking file preview is ready. Review it, then click Upload Booking File.",
      type: "success"
    });
    event.target.value = "";
  }

  async function loadSampleBookingUpload() {
    const content = await requestText("/api/admin/bookings/template");
    setUploadPreview({ fileName: "sample-booking-upload.csv", ...parseCsvPreview(content) });
    setPendingBookingUpload({ fileName: "sample-booking-upload.csv", content });
    setNotice({
      message: "Sample booking preview is ready. Review it, then click Upload Booking File.",
      type: "success"
    });
  }

  function removeBookingUpload() {
    setUploadPreview(null);
    setPendingBookingUpload(null);
    setNotice(null);
  }

  async function submitBookingUpload() {
    if (!pendingBookingUpload) return;
    const succeeded = await uploadContent(
      "/api/admin/bookings/import",
      pendingBookingUpload.fileName,
      pendingBookingUpload.content
    );
    if (succeeded) {
      setPendingBookingUpload(null);
      setUploadPreview(null);
      setBookingUploadModalOpen(false);
    }
  }
  async function saveArea(event) {
    event.preventDefault();
    if (!canAreaEdit) {
      setNotice({ message: "Area Manager inputs are read-only for your role.", type: "warning" });
      return;
    }
    const payload = formValues(event.currentTarget);
    await request(`/api/bookings/${selectedBooking.id}/area-inputs`, {
      method: "PATCH",
      body: JSON.stringify({ ...payload, updatedBy: user.id })
    });
    await loadBookings();
    setSelectedBooking(null);
    setNotice({ message: "Area Manager inputs saved.", type: "success" });
  }

  async function saveRegional(event) {
    event.preventDefault();
    if (!canRegionalEdit) {
      setNotice({ message: "Regional Manager inputs are read-only for your role.", type: "warning" });
      return;
    }
    const payload = formValues(event.currentTarget);
    await request(`/api/bookings/${selectedBooking.id}/regional-inputs`, {
      method: "PATCH",
      body: JSON.stringify({ ...payload, updatedBy: user.id })
    });
    await loadBookings();
    setSelectedBooking(null);
    setNotice({ message: "Regional Manager inputs saved.", type: "success" });
  }

  function changeAreaField(field) {
    setSelectedAreaField(field);
    setAreaOptionSearch("");
    setAreaOptionStatus("");
    setEditingOptionId(null);
    setOptionDraft("");
  }

  async function updateLookupOption(optionId, patch, successMessage) {
    try {
      const result = await request(`/api/admin/lookups/${selectedAreaField}/options/${encodeURIComponent(optionId)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...patch, updatedBy: user.id })
      });
      setBootstrap((current) => ({ ...current, lookups: result.lookups, lookupOptions: result.lookupOptions }));
      setNotice({ message: successMessage, type: "success" });
      setEditingOptionId(null);
      setOptionDraft("");
    } catch (error) {
      setNotice({ message: error.payload?.error || error.message, type: "error" });
    }
  }
  async function addLookupOption(label) {
    if (!label) {
      setAddOptionError("Option value is required.");
      return;
    }
    try {
      const result = await request(`/api/admin/lookups/${selectedAreaField}/options`, {
        method: "POST",
        body: JSON.stringify({ label, updatedBy: user.id })
      });
      setBootstrap((current) => ({
        ...current,
        lookups: result.lookups,
        lookupOptions: result.lookupOptions
      }));
      closeAddOptionModal();
      setNotice({ message: `${lookupFieldLabels[selectedAreaField]} option added.`, type: "success" });
    } catch (error) {
      setNotice({ message: error.payload?.error || error.message, type: "error" });
    }
  }

  function closeAddOptionModal() {
    setAddOptionModalOpen(false);
    setAddOptionError("");
  }
  return {
    changeBookingFilters,
    updateExcelFilters,
    clearBookingFilters,
    previewBookingFile,
    loadSampleBookingUpload,
    removeBookingUpload,
    submitBookingUpload,
    saveArea,
    saveRegional,
    changeAreaField,
    updateLookupOption,
    addLookupOption,
    closeAddOptionModal
  };
}
