"use client";

import Button from "./Button";

export default function ErrorState({
  title = "Something went wrong",
  description = "The page could not be completed. Your saved information has not been changed.",
  retryLabel = "Try again",
  onRetry,
  homeHref = "/",
  showHome = true,
  className = ""
}) {
  return (
    <div className={`app-error-state ${className}`.trim()} role="alert">
      <span className="app-error-state-icon" aria-hidden="true">
        !
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="app-error-state-actions">
        {onRetry ? (
          <Button type="button" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
        {showHome ? (
          <a className="button-link secondary-link" href={homeHref}>
            Return to dashboard
          </a>
        ) : null}
      </div>
    </div>
  );
}
