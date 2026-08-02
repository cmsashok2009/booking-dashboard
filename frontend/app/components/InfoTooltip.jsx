"use client";

import { useId } from "react";
import Button from "./ui/Button";

export default function InfoTooltip({ label, children, placement = "top" }) {
  const tooltipId = useId();
  return (
    <span className={`info-tooltip info-tooltip-${placement}`}>
      <Button
        className="info-tooltip-trigger"
        variant="ghost"
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={tooltipId}
      >
        <span aria-hidden="true">i</span>
      </Button>
      <span className="info-tooltip-content" id={tooltipId} role="tooltip">
        {children}
      </span>
    </span>
  );
}
