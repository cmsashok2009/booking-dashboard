"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import Button from "../../components/ui/Button";
import CloseButton from "../../components/ui/CloseButton";
import Select from "../../components/ui/Select";
import SideDrawer from "../../components/ui/SideDrawer";
import TextInput from "../../components/ui/TextInput";
import { request } from "../../utils/api";
import { getSingleUserRequirements } from "./singleUser";
import SingleUserMasterDataForm, { RequiredLabel, singleUserViewCopy } from "./SingleUserMasterDataForm";
import SingleUserPhoneField from "./SingleUserPhoneField";

const EMPTY_VALUES = {
  Name: "",
  Email: "",
  Phone: "",
  Role: "",
  Region: "",
  "Dealer Code": "",
  "Reporting Manager Email": ""
};

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
  const [phoneValidationVisible, setPhoneValidationVisible] = useState(false);
  const [availableRegions, setAvailableRegions] = useState(regions);
  const [availableDealerCodes, setAvailableDealerCodes] = useState(dealerCodes);
  const initializedForOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      initializedForOpenRef.current = false;
      return;
    }
    if (initializedForOpenRef.current) return;
    initializedForOpenRef.current = true;
    setValues({ ...EMPTY_VALUES, Role: role || "" });
    setView("form");
    setRegionReturnView("form");
    setMasterError("");
    setPhoneValidationVisible(false);
    setAvailableRegions(regions);
    setAvailableDealerCodes(dealerCodes);
  }, [dealerCodes, open, regions, role]);

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
      Region: current["Dealer Code"]
        ? current.Region
        : ["Area Manager", "Regional Manager"].includes(nextRole)
          ? current.Region
          : "All",
      "Reporting Manager Email": ""
    }));
    onRoleChange(nextRole);
  }

  const { title, description } = singleUserViewCopy(view);

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

      {view !== "form" ? (
        <SingleUserMasterDataForm
          view={view}
          regionReturnView={regionReturnView}
          selectedRegion={values.Region}
          regions={availableRegions}
          masterError={masterError}
          saving={savingMaster}
          setMasterError={setMasterError}
          setSaving={setSavingMaster}
          onRegionCreated={(result, returnView) => {
            const regionName = result.region.name;
            setValues((current) => ({ ...current, Region: regionName }));
            setAvailableRegions((current) => [...new Set([...current, regionName])].sort());
            onDataChanged?.();
            onClearError("Region");
            setView(returnView);
          }}
          onDealerCreated={(result) => {
            const dealerCode = result.dealerCode;
            setValues((current) => ({
              ...current,
              Region: dealerCode.region,
              "Dealer Code": dealerCode.code
            }));
            setAvailableDealerCodes((current) => [
              ...current.filter((item) => item.id !== dealerCode.id && item.code !== dealerCode.code),
              dealerCode
            ]);
            onDataChanged?.();
            onClearError("Dealer Code");
            onClearError("Region");
            setView("form");
          }}
          onBack={() => {
            setMasterError("");
            setView("form");
          }}
          onNeedRegion={() => {
            setMasterError("");
            setRegionReturnView("dealer");
            setView("region");
          }}
        />
      ) : (
        <form
          className="single-user-drawer-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (values.Phone && values.Phone.length !== 10) return setPhoneValidationVisible(true);
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
              <TextInput
                id="single-user-name"
                data-dialog-focus
                value={values.Name}
                className={errors.Name ? "input-error" : ""}
                required
                aria-invalid={Boolean(errors.Name)}
                aria-describedby={describedBy("Name")}
                onChange={(event) => updateValue("Name", event.target.value)}
              />
              {fieldError("Name")}
            </div>
            <div className="field">
              <RequiredLabel htmlFor="single-user-email">Email</RequiredLabel>
              <TextInput
                id="single-user-email"
                value={values.Email}
                className={errors.Email ? "input-error" : ""}
                type="email"
                required
                aria-invalid={Boolean(errors.Email)}
                aria-describedby={describedBy("Email")}
                onChange={(event) => updateValue("Email", event.target.value)}
              />
              {fieldError("Email")}
            </div>
            <SingleUserPhoneField
              value={values.Phone}
              error={errors.Phone}
              validationVisible={phoneValidationVisible}
              onChange={(value) => updateValue("Phone", value)}
              onValidationChange={setPhoneValidationVisible}
            />
            <div className="field">
              <RequiredLabel htmlFor="single-user-role">Role</RequiredLabel>
              <Select
                id="single-user-role"
                value={values.Role}
                className={errors.Role ? "input-error" : ""}
                required
                aria-invalid={Boolean(errors.Role)}
                aria-describedby={describedBy("Role")}
                onChange={(event) => changeRole(event.target.value)}
              >
                <option value="">Select role</option>
                {roles.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
              {fieldError("Role")}
            </div>
            {needsRegion ? (
              <div className="field">
                <div className="field-label-actions">
                  <RequiredLabel htmlFor="single-user-region">Region</RequiredLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    className="field-manage-button"
                    onClick={() => {
                      setMasterError("");
                      setRegionReturnView("form");
                      setView("region");
                    }}
                  >
                    <Plus size={16} aria-hidden="true" /> Add Region
                  </Button>
                </div>
                <Select
                  id="single-user-region"
                  value={values.Region}
                  className={errors.Region ? "input-error" : ""}
                  required
                  disabled={Boolean(values["Dealer Code"])}
                  aria-invalid={Boolean(errors.Region)}
                  aria-describedby={values["Dealer Code"] ? "single-user-region-link-hint" : describedBy("Region")}
                  onChange={(event) => updateValue("Region", event.target.value)}
                >
                  <option value="">Select region</option>
                  {availableRegions.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </Select>
                {values["Dealer Code"] ? (
                  <span id="single-user-region-link-hint" className="field-hint">
                    Region is linked to the selected Dealer Code.
                  </span>
                ) : null}
                {fieldError("Region")}
              </div>
            ) : null}
            <div className={`field${!needsRegion && !needsManager ? " single-user-dealer-field" : ""}`}>
              <div className="field-label-actions">
                <label htmlFor="single-user-dealer">Dealer Code</label>
                <Button
                  type="button"
                  variant="ghost"
                  className="field-manage-button"
                  onClick={() => {
                    setMasterError("");
                    setView("dealer");
                  }}
                >
                  <Plus size={16} aria-hidden="true" /> Add Dealer Code
                </Button>
              </div>
              <Select
                id="single-user-dealer"
                value={values["Dealer Code"]}
                onChange={(event) => changeDealerCode(event.target.value)}
              >
                <option value="">No Dealer Code</option>
                {activeDealers.map((item) => (
                  <option key={item.id} value={item.code}>
                    {item.code} - {item.region}
                  </option>
                ))}
              </Select>
              {fieldError("Dealer Code")}
            </div>
            {needsManager ? (
              <div className="field">
                <RequiredLabel htmlFor="single-user-manager">Reporting Manager Email</RequiredLabel>
                <TextInput
                  id="single-user-manager"
                  value={values["Reporting Manager Email"]}
                  className={errors["Reporting Manager Email"] ? "input-error" : ""}
                  type="email"
                  required
                  aria-invalid={Boolean(errors["Reporting Manager Email"])}
                  aria-describedby={describedBy("Reporting Manager Email")}
                  onChange={(event) => updateValue("Reporting Manager Email", event.target.value)}
                />
                {errors["Reporting Manager Email"] ? (
                  fieldError("Reporting Manager Email")
                ) : (
                  <span className="field-hint">
                    Enter an active {managerRole || "reporting manager"} account email.
                  </span>
                )}
              </div>
            ) : null}
            <div className="single-user-activation-note">
              <strong>Activation required</strong>
              <span>The user remains pending until they open the secure email link and create a password.</span>
            </div>
          </div>
          <footer className="single-user-drawer-footer">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Continue to invitation</Button>
          </footer>
        </form>
      )}
    </SideDrawer>
  );
}
