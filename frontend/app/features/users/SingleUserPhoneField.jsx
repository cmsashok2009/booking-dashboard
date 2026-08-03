"use client";

import TextInput from "../../components/ui/TextInput";

export default function SingleUserPhoneField({ value, error, validationVisible, onChange, onValidationChange }) {
  const message = error || (validationVisible ? "Phone must contain exactly 10 digits." : "");

  return (
    <div className="field">
      <label htmlFor="single-user-phone">Phone</label>
      <TextInput
        id="single-user-phone"
        value={value}
        type="text"
        inputMode="numeric"
        autoComplete="tel"
        pattern="[0-9]{10}"
        className={message ? "input-error" : ""}
        aria-invalid={Boolean(message)}
        aria-describedby={message ? "single-user-Phone-error" : "single-user-phone-hint"}
        onChange={(event) => {
          onChange(event.target.value.replace(/\D/g, "").slice(0, 10));
          onValidationChange(false);
        }}
        onBlur={() => onValidationChange(Boolean(value && value.length !== 10))}
      />
      {message ? (
        <span id="single-user-Phone-error" className="field-error">
          {message}
        </span>
      ) : (
        <span id="single-user-phone-hint" className="field-hint">
          Enter exactly 10 digits.
        </span>
      )}
    </div>
  );
}
