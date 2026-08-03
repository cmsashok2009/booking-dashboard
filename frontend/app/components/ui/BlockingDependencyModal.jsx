"use client";

import { useEffect, useId, useRef } from "react";
import Button from "./Button";
import CloseButton from "./CloseButton";
import ModalShell from "./ModalShell";

export default function BlockingDependencyModal({
  open,
  eyebrow = "Action blocked",
  title,
  description,
  detailLabel,
  detailValue,
  actionLabel = "Review dependencies",
  closeLabel = "Close",
  onAction,
  onClose
}) {
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      className="blocking-dependency-modal"
      backdropClassName="blocking-dependency-backdrop"
      role="alertdialog"
      ariaLabelledBy={titleId}
      ariaDescribedBy={descriptionId}
      nested
    >
      <header className="blocking-dependency-header">
        <span className="blocking-dependency-icon" aria-hidden="true">
          !
        </span>
        <div className="blocking-dependency-heading">
          <span className="modal-eyebrow">{eyebrow}</span>
          <h2 id={titleId}>{title}</h2>
        </div>
        <CloseButton onClick={onClose} label="Close dependency message" />
      </header>
      <div className="blocking-dependency-content">
        <p id={descriptionId}>{description}</p>
        {detailValue ? (
          <dl className="blocking-dependency-detail">
            <div>
              <dt>{detailLabel}</dt>
              <dd>{detailValue}</dd>
            </div>
          </dl>
        ) : null}
      </div>
      <footer className="blocking-dependency-footer">
        <Button ref={closeRef} type="button" variant="secondary" onClick={onClose}>
          {closeLabel}
        </Button>
        <Button type="button" onClick={onAction}>
          {actionLabel}
        </Button>
      </footer>
    </ModalShell>
  );
}
