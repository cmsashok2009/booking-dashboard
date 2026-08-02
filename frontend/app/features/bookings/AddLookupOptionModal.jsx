"use client";

import Button from "../../components/ui/Button";
import CloseButton from "../../components/ui/CloseButton";
import ModalShell from "../../components/ui/ModalShell";
import TextInput from "../../components/ui/TextInput";

export default function AddLookupOptionModal({ open, fieldLabel, error, onClearError, onClose, onSubmit }) {
  async function submit(event) {
    event.preventDefault();
    const label = new FormData(event.currentTarget).get("label")?.toString().trim() || "";
    await onSubmit(label);
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      className="small-modal area-option-modal"
      ariaLabelledBy="add-option-title"
    >
      <div className="modal-header">
        <div>
          <span className="modal-eyebrow">Dropdown management</span>
          <h2 id="add-option-title">Add {fieldLabel} option</h2>
          <p>The new value becomes available for future Area Manager updates.</p>
        </div>
        <CloseButton className="modal-close-button" onClick={onClose} label="Close add option" title="Close" />
      </div>
      <form className="grid" onSubmit={submit}>
        <div className="field">
          <label htmlFor="lookup-field-label">Dropdown field</label>
          <TextInput id="lookup-field-label" value={fieldLabel} readOnly />
        </div>
        <div className="field">
          <label htmlFor="lookup-option-label">
            Option value{" "}
            <span className="required-marker" aria-hidden="true">
              *
            </span>
          </label>
          <TextInput
            id="lookup-option-label"
            className={error ? "input-error" : ""}
            name="label"
            placeholder={`Enter ${fieldLabel.toLowerCase()} option`}
            data-dialog-focus
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "lookup-option-error" : undefined}
            onChange={onClearError}
          />
          {error ? (
            <small id="lookup-option-error" className="field-error">
              {error}
            </small>
          ) : null}
        </div>
        <div className="modal-form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add option</Button>
        </div>
      </form>
    </ModalShell>
  );
}
