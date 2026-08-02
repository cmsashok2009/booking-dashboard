"use client";

import { formValues } from "../../utils/forms";
import Button from "../../components/ui/Button";
import CloseButton from "../../components/ui/CloseButton";
import ModalShell from "../../components/ui/ModalShell";
import Select from "../../components/ui/Select";
import TextInput from "../../components/ui/TextInput";
import { getSingleUserRequirements } from "./singleUser";

function RequiredLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor}>
      {children}{" "}
      <span className="required-marker" aria-hidden="true">
        *
      </span>
    </label>
  );
}

export default function SingleUserModal({
  open,
  roles,
  regions,
  roleDefinitions,
  role,
  errors,
  onRoleChange,
  onClearError,
  onClose,
  onSubmit
}) {
  const { needsRegion, needsManager, managerRole } = getSingleUserRequirements(role, roleDefinitions);
  const fieldError = (name) =>
    errors[name] ? (
      <span id={`single-user-${name.replaceAll(" ", "-")}-error`} className="field-error">
        {errors[name]}
      </span>
    ) : null;
  const describedBy = (name) => (errors[name] ? `single-user-${name.replaceAll(" ", "-")}-error` : undefined);

  return (
    <ModalShell open={open} onClose={onClose} className="user-action-modal" ariaLabelledBy="single-user-title">
      <div className="modal-header">
        <div>
          <h2 id="single-user-title">Add Single User</h2>
          <p>Create one dashboard user, then review and send their activation email.</p>
        </div>
        <CloseButton className="modal-close-button" onClick={onClose} label="Close Add Single User" title="Close" />
      </div>
      <form
        className="form-grid"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(formValues(event.currentTarget));
        }}
      >
        <div className="field">
          <RequiredLabel htmlFor="single-user-name">Name</RequiredLabel>
          <TextInput
            id="single-user-name"
            data-dialog-focus
            className={errors.Name ? "input-error" : ""}
            name="Name"
            required
            aria-invalid={Boolean(errors.Name)}
            aria-describedby={describedBy("Name")}
            onChange={() => onClearError("Name")}
          />
          {fieldError("Name")}
        </div>
        <div className="field">
          <RequiredLabel htmlFor="single-user-email">Email</RequiredLabel>
          <TextInput
            id="single-user-email"
            className={errors.Email ? "input-error" : ""}
            name="Email"
            type="email"
            required
            aria-invalid={Boolean(errors.Email)}
            aria-describedby={describedBy("Email")}
            onChange={() => onClearError("Email")}
          />
          {fieldError("Email")}
        </div>
        <div className="field">
          <label htmlFor="single-user-phone">Phone</label>
          <TextInput id="single-user-phone" name="Phone" />
        </div>
        <div className="field">
          <RequiredLabel htmlFor="single-user-role">Role</RequiredLabel>
          <Select
            id="single-user-role"
            className={errors.Role ? "input-error" : ""}
            name="Role"
            value={role}
            required
            aria-invalid={Boolean(errors.Role)}
            aria-describedby={describedBy("Role")}
            onChange={(event) => onRoleChange(event.target.value)}
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
            <RequiredLabel htmlFor="single-user-region">Region</RequiredLabel>
            <Select
              id="single-user-region"
              className={errors.Region ? "input-error" : ""}
              name="Region"
              required
              aria-invalid={Boolean(errors.Region)}
              aria-describedby={describedBy("Region")}
              onChange={() => onClearError("Region")}
            >
              <option value="">Select region</option>
              {regions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
            {fieldError("Region")}
          </div>
        ) : (
          <TextInput type="hidden" name="Region" value="All" />
        )}
        <div className="field">
          <label htmlFor="single-user-dealer">Dealer Code</label>
          <TextInput id="single-user-dealer" name="Dealer Code" />
        </div>
        {needsManager ? (
          <div className="field">
            <RequiredLabel htmlFor="single-user-manager">Reporting Manager Email</RequiredLabel>
            <TextInput
              id="single-user-manager"
              className={errors["Reporting Manager Email"] ? "input-error" : ""}
              name="Reporting Manager Email"
              type="email"
              required
              aria-invalid={Boolean(errors["Reporting Manager Email"])}
              aria-describedby={describedBy("Reporting Manager Email")}
              onChange={() => onClearError("Reporting Manager Email")}
            />
            {errors["Reporting Manager Email"] ? (
              fieldError("Reporting Manager Email")
            ) : (
              <span className="field-hint">Select an active {managerRole || "reporting manager"} account.</span>
            )}
          </div>
        ) : (
          <TextInput type="hidden" name="Reporting Manager Email" value="" />
        )}
        <div className="single-user-activation-note">
          <strong>Activation required</strong>
          <span>The user remains pending until they open the secure email link and create a password.</span>
        </div>
        <div className="modal-form-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Continue to invitation</Button>
        </div>
      </form>
    </ModalShell>
  );
}
