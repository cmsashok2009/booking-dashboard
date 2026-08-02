"use client";

import { useEffect, useRef } from "react";
import Button from "./ui/Button";
import CloseButton from "./ui/CloseButton";
import ModalShell from "./ui/ModalShell";

export default function ConfirmationModal({
  open,
  eyebrow = "Confirmation",
  title,
  description,
  detailLabel,
  detailValue,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  tone = "warning",
  onConfirm,
  onClose
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    window.requestAnimationFrame(() => cancelRef.current?.focus());
  }, [open]);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      className={`confirmation-modal ${tone}`}
      role="alertdialog"
      ariaLabelledBy="confirmation-modal-title"
      ariaDescribedBy="confirmation-modal-description"
      closeDisabled={busy}
      nested
    >
      <header className="modal-header confirmation-modal-header">
        <div className="confirmation-modal-heading">
          <span className="modal-eyebrow">{eyebrow}</span>
          <div className="confirmation-modal-title-row">
            <span className="confirmation-modal-icon" aria-hidden="true">
              !
            </span>
            <h2 id="confirmation-modal-title">{title}</h2>
          </div>
        </div>
        <CloseButton className="modal-close-button" disabled={busy} onClick={onClose} label="Close confirmation" />
      </header>
      <div className="confirmation-modal-content">
        <p id="confirmation-modal-description">{description}</p>
        {detailValue ? (
          <div className="confirmation-modal-detail">
            <span>{detailLabel}</span>
            <strong>{detailValue}</strong>
          </div>
        ) : null}
      </div>
      <footer className="confirmation-modal-footer">
        <Button ref={cancelRef} type="button" variant="secondary" disabled={busy} onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={tone === "danger" ? "danger" : "primary"}
          busy={busy}
          busyLabel="Processing..."
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </footer>
    </ModalShell>
  );
}
