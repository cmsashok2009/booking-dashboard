"use client";

import { bookingUploadHeaders } from "../../constants/dashboard";
import { displayValue } from "../../utils/bookings";
import Button from "../../components/ui/Button";
import CloseButton from "../../components/ui/CloseButton";
import FileInput from "../../components/ui/FileInput";
import ModalShell from "../../components/ui/ModalShell";
import TableEmptyState from "../../components/ui/TableEmptyState";

const MIN_PREVIEW_COLUMN_WIDTH = 104;
const MAX_PREVIEW_COLUMN_WIDTH = 340;
const PREVIEW_COLUMN_BASELINES = {
  "Dealer Code": 112,
  "Contact First Name": 144,
  "Contact Last Name": 144,
  "Institution Name": 190,
  "Phone Number": 132,
  "Sales Order Id": 140,
  "Creation Date": 132,
  "Dlr GRP": 104,
  AM: 104,
  Region: 112,
  Category: 120,
  MODEL: 150,
  VARIANT: 220,
  "Color mapped": 130,
  CAT: 104,
  VINYEAR: 110,
  "matching vin stock": 150,
  "MATCHED STATUS": 220,
  "AGING BOOKINFS": 112,
  "AVL STATUS": 200,
  "RPOS ORDER STATUS": 190,
  "RPASS BKG": 180,
  COMB1: 280,
  "Booking Category": 180,
  "Wholesales Feedback": 200,
  "WS Planning": 190,
  "Expected Retail Date": 150,
  Remarks: 220,
  "Wholesale Input": 280,
  "Retail Input": 280
};

function clampColumnWidth(width) {
  return Math.min(MAX_PREVIEW_COLUMN_WIDTH, Math.max(MIN_PREVIEW_COLUMN_WIDTH, Math.round(width)));
}

function previewColumnWidth(header, columnIndex, rows) {
  const values = rows.map((row) => String(row[columnIndex] ?? "").trim()).filter(Boolean);
  const headerText = String(header).replace(/^\uFEFF/, "").trim();
  const samples = [headerText, ...values];
  const longestValue = Math.max(...samples.map((value) => value.length), 0);
  const longestToken = Math.max(
    ...samples.flatMap((value) => value.split(/[\s/\-]+/)).map((token) => token.length),
    0
  );
  const numericValues = values.length > 0 && values.every((value) => /^(?:#N\/A|\d+(?:\.\d+)?)$/i.test(value));
  const dateValues = values.length > 0 && values.every((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) || value === "53");

  const baselineWidth = PREVIEW_COLUMN_BASELINES[headerText] || MIN_PREVIEW_COLUMN_WIDTH;
  const headerWidth = Math.max(longestToken * 8 + 32, Math.ceil(headerText.length / 2) * 7 + 32);
  if (numericValues) return clampColumnWidth(Math.max(baselineWidth, headerWidth));
  if (dateValues) return clampColumnWidth(Math.max(baselineWidth, headerWidth, 132));

  const contentWidth =
    longestValue > 32 ? longestValue * 6.5 + 36 : longestValue > 18 ? longestValue * 7 + 34 : longestValue * 7.5 + 32;
  return clampColumnWidth(Math.max(baselineWidth, headerWidth, contentWidth));
}

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
  const previewColumnWidths = previewHeaders.map((header, columnIndex) =>
    previewColumnWidth(header, columnIndex, previewRows)
  );
  const previewTableWidth = previewColumnWidths.reduce((total, width) => total + width, 0);

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
        <div className="booking-preview-table-shell">
          <div className="table-wrap booking-preview-table">
            <table style={{ width: `${previewTableWidth}px` }}>
              <colgroup>
                {previewHeaders.map((header, columnIndex) => (
                  <col key={header} style={{ width: `${previewColumnWidths[columnIndex]}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {previewHeaders.map((header) => (
                    <th key={header}>{String(header).replace(/^\uFEFF/, "")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {previewHeaders.map((header, index) => (
                      <td key={header}>
                        <span className="booking-preview-cell-content" title={String(displayValue(row[index]))}>
                          {displayValue(row[index])}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!previewRows.length ? (
            <div className="booking-preview-empty-overlay">
              <TableEmptyState description="Choose a CSV or use sample data to preview bookings." />
            </div>
          ) : null}
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
