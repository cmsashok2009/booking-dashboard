"use client";

import PasswordRevealButton from "./PasswordRevealButton";
import Field from "./ui/Field";
import TextInput from "./ui/TextInput";

export const PASSWORD_RULES = [
  { label: "At least 10 characters", test: (value) => value.length >= 10 },
  { label: "One uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value) => /[a-z]/.test(value) },
  { label: "One number", test: (value) => /[0-9]/.test(value) }
];

export function isStrongPassword(value) {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

export default function PasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  showPassword,
  onVisibilityChange,
  prefix = "password"
}) {
  const passedRules = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  const mismatch = Boolean(confirmPassword && password !== confirmPassword);
  return (
    <>
      <Field label="New password" htmlFor={`${prefix}-new`} required>
        <div className="password-control">
          <TextInput
            id={`${prefix}-new`}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            required
            autoComplete="new-password"
            aria-describedby={`${prefix}-rules`}
          />
          <PasswordRevealButton onVisibilityChange={onVisibilityChange} />
        </div>
      </Field>
      <Field
        label="Confirm password"
        htmlFor={`${prefix}-confirm`}
        required
        error={mismatch ? "Passwords do not match." : ""}
      >
        <TextInput
          id={`${prefix}-confirm`}
          type="password"
          value={confirmPassword}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
          required
          autoComplete="new-password"
          aria-invalid={mismatch}
        />
      </Field>
      <div id={`${prefix}-rules`} className="password-rules">
        <div>
          <strong>Password strength</strong>
          <span>
            {passedRules} of {PASSWORD_RULES.length} requirements
          </span>
        </div>
        <ul>
          {PASSWORD_RULES.map((rule) => (
            <li className={rule.test(password) ? "passed" : ""} key={rule.label}>
              <span className="password-rule-icon" aria-hidden="true">
                {rule.test(password) ? "✓" : "-"}
              </span>
              {rule.label}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
