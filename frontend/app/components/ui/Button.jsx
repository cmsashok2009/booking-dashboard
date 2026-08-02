"use client";

import { forwardRef } from "react";
import Loader from "./Loader";

const VARIANT_CLASS = {
  primary: "",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  danger: "danger-button",
  dangerQuiet: "danger-quiet",
  link: "button-link"
};

const SIZE_CLASS = {
  sm: "button-sm",
  md: "",
  lg: "button-lg"
};

const Button = forwardRef(function Button(props, ref) {
  const {
    children,
    className = "",
    disabled = false,
    busy = false,
    busyLabel,
    fullWidth = false,
    leadingIcon = null,
    trailingIcon = null,
    type = "button",
    variant = "primary",
    size = "md",
    ...rest
  } = props;

  const classes = [
    "app-button",
    VARIANT_CLASS[variant] || "",
    SIZE_CLASS[size] || "",
    fullWidth ? "button-full-width" : "",
    busy ? "is-busy" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {leadingIcon ? (
        <span className="button-icon button-icon-leading" aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      <span className="button-label">
        {busy ? <Loader label={busyLabel || "Working"} size="sm" /> : null}
        {busy && busyLabel ? busyLabel : children}
      </span>
      {trailingIcon ? (
        <span className="button-icon button-icon-trailing" aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
});

export default Button;
