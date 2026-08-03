import Button from "./ui/Button";

export default function UnsavedChangesDialog({ open, stayButtonRef, discardButtonRef, onStay, onDiscard }) {
  if (!open) return null;
  return (
    <div className="confirm-backdrop" role="presentation">
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-title"
        aria-describedby="discard-description"
      >
        <span className="confirm-icon" aria-hidden="true">
          !
        </span>
        <div>
          <h2 id="discard-title">Discard unsaved changes?</h2>
          <p id="discard-description">
            You changed this user but have not saved yet. Discard the changes to leave the row.
          </p>
        </div>
        <div className="confirm-actions">
          <Button ref={stayButtonRef} type="button" variant="secondary" onClick={onStay}>
            Stay Editing
          </Button>
          <Button ref={discardButtonRef} type="button" variant="danger" onClick={onDiscard}>
            Discard Changes
          </Button>
        </div>
      </section>
    </div>
  );
}
