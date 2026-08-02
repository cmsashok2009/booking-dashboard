"use client";

import Loader from "./Loader";

export default function LoadingState({
  title = "Loading",
  description = "Please wait while we retrieve the latest information.",
  className = ""
}) {
  return (
    <div className={`app-loading-state ${className}`.trim()} aria-busy="true">
      <Loader label={title} size="lg" />
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
