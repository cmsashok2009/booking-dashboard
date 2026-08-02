"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Button from "../../components/ui/Button";
import CloseButton from "../../components/ui/CloseButton";
import Select from "../../components/ui/Select";
import SideDrawer from "../../components/ui/SideDrawer";
import TextInput from "../../components/ui/TextInput";
import { request } from "../../utils/api";
import { getSingleUserRequirements } from "./singleUser";

const EMPTY_VALUES = {
  Name: "",
  Email: "",
  Phone: "",
  Role: "",
  Region: "",
  "Dealer Code": "",
  "Reporting Manager Email": ""
};

function RequiredLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor}>
      {children} <span className="required-marker" aria-hidden="true">*</span>
    </label>
  );
}

export default function SingleUserModal({
  open,
  roles,
  regions,
  dealerCodes = [],
  roleDefinitions,
  role,
  errors,
  onRoleChange,
  onClearError,
  onDataChanged,
  onClose,
  onSubmit
}) {
  const [values, setValues] = useState(EMPTY_VALUES);
  const [view, setView] = useState("form");
  const [regionReturnView, setRegionReturnView] = useState("form");
  const [masterError, setMasterError] = useState("");
  const [savingMaster, setSavingMaster] = useState(false);
  const [availableRegions, setAvailableRegions] = useState(regions);
  const [availableDealerCodes, setAvailableDealerCodes] = useState(dealerCodes);

  useEffect(() => {
    if (!open) return;
    setValues({ ...EMPTY_VALUES, Role: role || "" });
    setView("form");
    setRegionReturnView("form");
    setMasterError("");
    setAvailableRegions(regions);
    setAvailableDealerCodes(dealerCodes);
  }, [open]);

  if (!open) return null;

  const { needsRegion, needsManager, managerRole } = getSingleUserRequirements(values.Role, roleDefinitions);
  const activeDealers = availableDealerCodes.filter((item) => item.status === "active");
  const fieldError = (name) =>
    errors[name] ? (
      <span id={`single-user-${name.replaceAll(" ", "-")}-error`} className="field-error">
        {errors[name]}
      </span>
    ) : null;
  const describedBy = (name) => (errors[name] ? `single-user-${name.replaceAll(" ", "-")}-error` : undefined);

  function updateValue(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    onClearError(name);
  }

  function changeDealerCode(code) {
    const dealer = activeDealers.find((item) => item.code === code);
    setValues((current) => ({
      ...current,
      "Dealer Code": code,
      Region: dealer?.region || current.Region
    }));
    onClearError("Dealer Code");
    if (dealer) onClearError("Region");
  }

  function changeRole(nextRole) {
    setValues((current) => ({
      ...current,
      Role: nextRole,
      Region: current["Dealer Code"] ? current.Region : ["Area Manager", "Regional Manager"].includes(nextRole) ? current.Region : "All",
      "Reporting Manager Email": ""
    }));
    onRoleChange(nextRole);
  }

  async function addRegion(event) {
    event.preventDefault();
    setMasterError("");
    const name = new FormData(event.currentTarget).get("name")?.toString() || "";
    setSavingMaster(true);
    try {
      const result = await request("/api/admin/regions", {
        method: "POST",
        body: JSON.stringify({ name })
      });
      setValues((current) => ({ ...current, Region: result.region.name }));
      setAvailableRegions(result.regions);
      onDataChanged?.({ regions: result.regions });
      onClearError("Region");
      setView(regionReturnView);
    } catch (error) {
      setMasterError(error.payload?.error || error.message);
    } finally {
      setSavingMaster(false);
    }
  }

  async function addDealerCode(event) {
    event.preventDefault();
    setMasterError("");
    const form = new FormData(event.currentTarget);
    setSavingMaster(true);
    try {
      const result = await request("/api/admin/dealer-codes", {
        method: "POST",
        body: JSON.stringify({ code: form.get("code"), region: form.get("region") })
      });
      setValues((current) => ({
        ...current,
        Region: result.dealerCode.region,
        "Dealer Code": result.dealerCode.code
      }));
      setAvailableDealerCodes(result.dealerCodes);
      onDataChanged?.({ dealerCodes: result.dealerCodes });
      onClearError("Dealer Code");
      onClearError("Region");
      setView("form");
    } catch (error) {
      setMasterError(error.payload?.error || error.message);
    } finally {
      setSavingMaster(false);
    }
  }

  const title = view === "region" ? "Add Region" : view === "dealer" ? "Add Dealer Code" : "Add Single User";
  const description =
    view === "region"
      ? "Create a reusable Region and return to the user form."
      : view === "dealer"
        ? "Create a Dealer Code for an existing Region and return to the user form."
        : "Create one dashboard user, then review and send their activation email.";

  return (
    <SideDrawer
      className="single-user-drawer"
      labelledBy="single-user-title"
      describedBy="single-user-description"
      closeDisabled={savingMaster}
      onClose={onClose}
    >
      <header className="modal-header single-user-drawer-header">
        <div>
          <span className="modal-eyebrow">{view === "form" ? "Access management" : "Master data"}</span>
          <h2 id="single-user-title">{title}</h2>
          <p id="single-user-description">{description}</p>
        </div>
        <CloseButton className="modal-close-button" onClick={onClose} disabled={savingMaster} label="Close" />
      </header>

      {view === "region" ? (
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
              {masterError ? <span id="master-data-error" className="field-error">{masterError}</span> : null}
            </div>
          </div>
          <footer className="single-user-drawer-footer">
            <Button type="button" variant="secondary" onClick={() => { setMasterError(""); setView("form"); }}>Back to user</Button>
            <Button type="submit" busy={savingMaster} busyLabel="Adding region...">Add and select Region</Button>
          </footer>
        </form>
      ) : view === "dealer" ? (
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
              <Select id="new-dealer-region" name="region" defaultValue={values.Region || ""}>
                <option value="">Select region</option>
                {availableRegions.map((item) => <option key={item}>{item}</option>)}
              </Select>
            </div>
            {masterError ? <span id="master-data-error" className="field-error">{masterError}</span> : null}
            {!availableRegions.length ? (
              <div className="activation-warning" role="note">
                <span>Add a Region first, then return here to create the Dealer Code.</span>
                <Button type="button" variant="secondary" onClick={() => { setMasterError(""); setRegionReturnView("dealer"); setView("region"); }}>
                  <Plus size={16} aria-hidden="true" /> Add Region
                </Button>
              </div>
            ) : null}
          </div>
          <footer className="single-user-drawer-footer">
            <Button type="button" variant="secondary" onClick={() => { setMasterError(""); setView("form"); }}>Back to user</Button>
            <Button type="submit" busy={savingMaster} busyLabel="Adding Dealer Code..." disabled={!availableRegions.length}>Add and select Dealer Code</Button>
          </footer>
        </form>
      ) : (
        <form
          className="single-user-drawer-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              ...values,
              Region: values["Dealer Code"] ? values.Region : needsRegion ? values.Region : "All",
              "Reporting Manager Email": needsManager ? values["Reporting Manager Email"] : ""
            });
          }}
        >
          <div className="single-user-drawer-body form-grid">
            <div className="field">
              <RequiredLabel htmlFor="single-user-name">Name</RequiredLabel>
              <TextInput id="single-user-name" data-dialog-focus value={values.Name} className={errors.Name ? "input-error" : ""} required aria-invalid={Boolean(errors.Name)} aria-describedby={describedBy("Name")} onChange={(event) => updateValue("Name", event.target.value)} />
              {fieldError("Name")}
            </div>
            <div className="field">
              <RequiredLabel htmlFor="single-user-email">Email</RequiredLabel>
              <TextInput id="single-user-email" value={values.Email} className={errors.Email ? "input-error" : ""} type="email" required aria-invalid={Boolean(errors.Email)} aria-describedby={describedBy("Email")} onChange={(event) => updateValue("Email", event.target.value)} />
              {fieldError("Email")}
            </div>
            <div className="field">
              <label htmlFor="single-user-phone">Phone</label>
              <TextInput id="single-user-phone" value={values.Phone} onChange={(event) => updateValue("Phone", event.target.value)} />
            </div>
            <div className="field">
              <RequiredLabel htmlFor="single-user-role">Role</RequiredLabel>
              <Select id="single-user-role" value={values.Role} className={errors.Role ? "input-error" : ""} required aria-invalid={Boolean(errors.Role)} aria-describedby={describedBy("Role")} onChange={(event) => changeRole(event.target.value)}>
                <option value="">Select role</option>
                {roles.map((item) => <option key={item}>{item}</option>)}
              </Select>
              {fieldError("Role")}
            </div>
            {needsRegion ? (
              <div className="field">
                <div className="field-label-actions">
                  <RequiredLabel htmlFor="single-user-region">Region</RequiredLabel>
                  <Button type="button" variant="ghost" className="field-manage-button" onClick={() => { setMasterError(""); setRegionReturnView("form"); setView("region"); }}>
                    <Plus size={16} aria-hidden="true" /> Add Region
                  </Button>
                </div>
                <Select id="single-user-region" value={values.Region} className={errors.Region ? "input-error" : ""} required disabled={Boolean(values["Dealer Code"])} aria-invalid={Boolean(errors.Region)} aria-describedby={values["Dealer Code"] ? "single-user-region-link-hint" : describedBy("Region")} onChange={(event) => updateValue("Region", event.target.value)}>
                  <option value="">Select region</option>
                  {availableRegions.map((item) => <option key={item}>{item}</option>)}
                </Select>
                {values["Dealer Code"] ? <span id="single-user-region-link-hint" className="field-hint">Region is linked to the selected Dealer Code.</span> : null}
                {fieldError("Region")}
              </div>
            ) : null}
            <div className="field">
              <div className="field-label-actions">
                <label htmlFor="single-user-dealer">Dealer Code</label>
                <Button type="button" variant="ghost" className="field-manage-button" onClick={() => { setMasterError(""); setView("dealer"); }}>
                  <Plus size={16} aria-hidden="true" /> Add Dealer Code
                </Button>
              </div>
              <Select id="single-user-dealer" value={values["Dealer Code"]} onChange={(event) => changeDealerCode(event.target.value)}>
                <option value="">No Dealer Code</option>
                {activeDealers.map((item) => <option key={item.id} value={item.code}>{item.code} - {item.region}</option>)}
              </Select>
              {fieldError("Dealer Code")}
            </div>
            {needsManager ? (
              <div className="field">
                <RequiredLabel htmlFor="single-user-manager">Reporting Manager Email</RequiredLabel>
                <TextInput id="single-user-manager" value={values["Reporting Manager Email"]} className={errors["Reporting Manager Email"] ? "input-error" : ""} type="email" required aria-invalid={Boolean(errors["Reporting Manager Email"])} aria-describedby={describedBy("Reporting Manager Email")} onChange={(event) => updateValue("Reporting Manager Email", event.target.value)} />
                {errors["Reporting Manager Email"] ? fieldError("Reporting Manager Email") : <span className="field-hint">Enter an active {managerRole || "reporting manager"} account email.</span>}
              </div>
            ) : null}
            <div className="single-user-activation-note">
              <strong>Activation required</strong>
              <span>The user remains pending until they open the secure email link and create a password.</span>
            </div>
          </div>
          <footer className="single-user-drawer-footer">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit">Continue to invitation</Button>
          </footer>
        </form>
      )}
    </SideDrawer>
  );
}
