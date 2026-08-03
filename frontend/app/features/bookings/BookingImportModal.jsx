"use client";

import { bookingUploadHeaders } from "../../constants/dashboard";
import { displayValue } from "../../utils/bookings";
import Button from "../../components/ui/Button";
import CloseButton from "../../components/ui/CloseButton";
import FileInput from "../../components/ui/FileInput";
import ModalShell from "../../components/ui/ModalShell";
import TableEmptyState from "../../components/ui/TableEmptyState";

export default function BookingImportModal({
  open,
  preview,
  pendingUpload,
  onChooseFile,
  onClose,
  onLoadSample,
  onRemoveFile,
  onUpload
}) {
  const previewHeaders = preview?.headers?.length ? preview.headers : bookingUploadHeaders;
  const previewRows = preview?.rows || [];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      className="booking-upload-modal has-preview"
      ariaLabelledBy="booking-upload-title"
    >
      <div className="modal-header booking-upload-header">
        <div>
          <span className="modal-eyebrow">Data import</span>
          <h2 id="booking-upload-title">Upload bookings</h2>
          <p>Add new bookings or update existing rows using Sales Order ID.</p>
        </div>
        <CloseButton className="modal-close-button" onClick={onClose} label="Close booking upload" title="Close" />
      </div>

      <div className="booking-import-toolbar">
        <label className="booking-file-drop">
          <span className="booking-file-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15v4h14v-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>
            <strong>{pendingUpload ? "Booking CSV ready" : "Choose a booking CSV"}</strong>
            <small>
              {pendingUpload
                ? (preview?.fileName || pendingUpload.fileName) + " - validated before import"
                : "CSV only. The file is validated before anything is imported."}
            </small>
          </span>
          <span className="button-link">{pendingUpload ? "Replace file" : "Choose file"}</span>
          <FileInput className="visually-hidden" accept=".csv,text/csv" onChange={onChooseFile} />
        </label>

        <div className="booking-import-actions">
          <a className="button-link secondary-link" href="/api/admin/bookings/template">
            Download template
          </a>
          <Button variant="secondary" type="button" onClick={onLoadSample}>
            Use sample data
          </Button>
        </div>
      </div>

      <div className="booking-upload-preview">
        <div className="booking-preview-heading">
          <div>
            <h3>Preview</h3>
            <p>{preview ? `${preview.fileName} | showing up to 10 rows` : "Choose a CSV or use sample data."}</p>
          </div>
          <span>{previewRows.length} preview rows</span>
        </div>
        <div className="table-wrap booking-preview-table">
          <table>
            <thead>
              <tr>
                {previewHeaders.map((header) => (
                  <th
                    key={header}
                    className={["Wholesale Input", "Retail Input"].includes(header) ? "booking-preview-wide-column" : undefined}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.length ? (
                previewRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {previewHeaders.map((header, index) => (
                      <td
                        key={header}
                        className={["Wholesale Input", "Retail Input"].includes(header) ? "booking-preview-wide-column" : undefined}
                      >
                        {displayValue(row[index])}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr className="booking-preview-empty-row">
                  <td colSpan={previewHeaders.length}>
                    <TableEmptyState description="Choose a CSV or use sample data to preview bookings." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pendingUpload ? (
          <div className="booking-preview-footer">
            <Button variant="secondary" type="button" onClick={onRemoveFile}>
              Remove file
            </Button>
            <Button type="button" onClick={onUpload}>
              Upload {previewRows.length} preview rows
            </Button>
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}
