"use client";

import useDialogLifecycle from "./useDialogLifecycle";

export default function ModalShell({
  open = true,
  onClose,
  className = "",
  ariaLabelledBy,
  ariaDescribedBy,
  closeDisabled = false,
  nested = false,
  suspended = false,
  role = "dialog",
  children
}) {
  const dialogRef = useDialogLifecycle({ active: open && !suspended, closeDisabled, onClose });

  if (!open) return null;

  return (
    <div
      className={`modal-backdrop ${nested ? "nested-modal-backdrop" : ""}`.trim()}
      onMouseDown={(event) => event.target === event.currentTarget && !closeDisabled && onClose?.()}
    >
      <section
        ref={dialogRef}
        className={`modal ${className}`.trim()}
        role={role}
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-hidden={suspended || undefined}
        inert={suspended ? true : undefined}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>
  );
}
