"use client";

import { Plus } from "lucide-react";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import TextInput from "../../components/ui/TextInput";
import { request } from "../../utils/api";

export function singleUserViewCopy(view) {
  if (view === "region")
    return { title: "Add Region", description: "Create a reusable Region and return to the user form." };
  if (view === "dealer") {
    return {
      title: "Add Dealer Code",
      description: "Create a Dealer Code for an existing Region and return to the user form."
    };
  }
  return {
    title: "Add Single User",
    description: "Create one dashboard user, then review and send their activation email."
  };
}
export function RequiredLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor}>
      {children}{" "}
      <span className="required-marker" aria-hidden="true">
        *
      </span>
    </label>
  );
}

export default function SingleUserMasterDataForm({
  view,
  regionReturnView,
  selectedRegion,
  regions,
  masterError,
  saving,
  setMasterError,
  setSaving,
  onRegionCreated,
  onDealerCreated,
  onBack,
  onNeedRegion
}) {
  async function addRegion(event) {
    event.preventDefault();
    setMasterError("");
    const name = new FormData(event.currentTarget).get("name")?.toString() || "";
    setSaving(true);
    try {
      const result = await request("/api/admin/regions", {
        method: "POST",
        body: JSON.stringify({ name })
      });
      onRegionCreated(result, regionReturnView);
    } catch (error) {
      setMasterError(error.payload?.error || error.message);
    } finally {
      setSaving(false);
    }
  }

  async function addDealerCode(event) {
    event.preventDefault();
    setMasterError("");
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const result = await request("/api/admin/dealer-codes", {
        method: "POST",
        body: JSON.stringify({ code: form.get("code"), region: form.get("region") })
      });
      onDealerCreated(result);
    } catch (error) {
      setMasterError(error.payload?.error || error.message);
    } finally {
      setSaving(false);
    }
  }

  if (view === "region") {
    return (
      <form className="single-user-drawer-form" onSubmit={addRegion}>
        <div className="single-user-drawer-body">
          <div className="field">
            <RequiredLabel htmlFor="new-region-name">Region name</RequiredLabel>
            <TextInput
              id="new-region-name"
              name="name"
              data-dialog-focus
              autoComplete="off"
              className={masterError ? "input-error" : ""}
              aria-invalid={Boolean(masterError)}
              aria-describedby={masterError ? "master-data-error" : undefined}
              onChange={() => setMasterError("")}
            />
            {masterError ? (
              <span id="master-data-error" className="field-error">
                {masterError}
              </span>
            ) : null}
          </div>
        </div>
        <footer className="single-user-drawer-footer">
          <Button type="button" variant="secondary" onClick={onBack}>
            Back to user
          </Button>
          <Button type="submit" busy={saving} busyLabel="Adding region...">
            Add and select Region
          </Button>
        </footer>
      </form>
    );
  }

  return (
    <form className="single-user-drawer-form" onSubmit={addDealerCode}>
      <div className="single-user-drawer-body">
        <div className="field">
          <RequiredLabel htmlFor="new-dealer-code">Dealer Code</RequiredLabel>
          <TextInput
            id="new-dealer-code"
            name="code"
            data-dialog-focus
            autoComplete="off"
            className={masterError ? "input-error" : ""}
            aria-invalid={Boolean(masterError)}
            onChange={() => setMasterError("")}
          />
        </div>
        <div className="field">
          <RequiredLabel htmlFor="new-dealer-region">Region</RequiredLabel>
          <Select id="new-dealer-region" name="region" defaultValue={selectedRegion || ""}>
            <option value="">Select region</option>
            {regions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </div>
        {masterError ? (
          <span id="master-data-error" className="field-error">
            {masterError}
          </span>
        ) : null}
        {!regions.length ? (
          <div className="activation-warning" role="note">
            <span>Add a Region first, then return here to create the Dealer Code.</span>
            <Button type="button" variant="secondary" onClick={onNeedRegion}>
              <Plus size={16} aria-hidden="true" /> Add Region
            </Button>
          </div>
        ) : null}
      </div>
      <footer className="single-user-drawer-footer">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back to user
        </Button>
        <Button type="submit" busy={saving} busyLabel="Adding Dealer Code..." disabled={!regions.length}>
          Add and select Dealer Code
        </Button>
      </footer>
    </form>
  );
}
