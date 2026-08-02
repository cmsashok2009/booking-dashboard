"use client";

import Button from "../../components/ui/Button";
import CloseButton from "../../components/ui/CloseButton";
import ModalShell from "../../components/ui/ModalShell";
import Select from "../../components/ui/Select";
import TextInput from "../../components/ui/TextInput";

export default function AddLookupOptionModal({ open, fieldCode, fieldLabel, regions = [], error, onClearError, onClose, onSubmit }) {
  const isRegion = fieldCode === "regions";
  const isDealer = fieldCode === "dealerCodes";
  const valueLabel = isRegion ? "Region name" : isDealer ? "Dealer Code" : "Option value";

  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const label = data.get("label")?.toString().trim() || "";
    await onSubmit(isDealer ? { code: label, region: data.get("region")?.toString() || "" } : label);
  }

  return (
    <ModalShell open={open} onClose={onClose} className="small-modal area-option-modal" ariaLabelledBy="add-option-title">
      <div className="modal-header">
        <div>
          <span className="modal-eyebrow">Reference data</span>
          <h2 id="add-option-title">Add {fieldLabel}</h2>
          <p>{isRegion || isDealer ? "The active value becomes available during user onboarding and bulk upload." :
            "The active value becomes available for future booking updates."}</p>
        </div>
        <CloseButton className="modal-close-button" onClick={onClose} label="Close add value" title="Close" />
      </div>
      <form className="grid" onSubmit={submit}>
        <div className="field">
          <label htmlFor="lookup-option-label">{valueLabel} <span className="required-marker" aria-hidden="true">*</span></label>
          <TextInput id="lookup-option-label" className={error ? "input-error" : ""} name="label"
            placeholder={`Enter ${valueLabel.toLowerCase()}`} data-dialog-focus aria-invalid={Boolean(error)}
            aria-describedby={error ? "lookup-option-error" : undefined} onChange={onClearError} />
          {error ? <small id="lookup-option-error" className="field-error">{error}</small> : null}
        </div>
        {isDealer ? (
          <div className="field">
            <label htmlFor="lookup-dealer-region">Region <span className="required-marker" aria-hidden="true">*</span></label>
            <Select id="lookup-dealer-region" name="region" required defaultValue="">
              <option value="" disabled>Select region</option>
              {regions.map((region) => <option value={region} key={region}>{region}</option>)}
            </Select>
          </div>
        ) : null}
        <div className="modal-form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">{isRegion ? "Add region" : isDealer ? "Add dealer code" : "Add option"}</Button>
        </div>
      </form>
    </ModalShell>
  );
}
