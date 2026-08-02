"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CloseButton from "./ui/CloseButton";

const icons = {
  success: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 11v6" />
      <path d="M12 7h.01" />
    </svg>
  )
};

const titles = {
  success: "Success",
  warning: "Attention required",
  error: "Action failed",
  info: "Information"
};

export default function NotificationToast({ notice, onClose, duration }) {
  const [phase, setPhase] = useState(notice?.message ? "visible" : "hidden");
  const closeTimer = useRef(null);
  const exitTimer = useRef(null);
  const type = ["success", "warning", "error", "info"].includes(notice?.type) ? notice.type : "info";
  const timeout = duration ?? (type === "error" ? 7000 : type === "warning" ? 6000 : 4500);

  const dismiss = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    setPhase("exiting");
    exitTimer.current = window.setTimeout(() => {
      setPhase("hidden");
      onClose?.();
    }, 220);
  }, [onClose]);

  useEffect(() => {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(exitTimer.current);
    if (!notice?.message) {
      setPhase("hidden");
      return undefined;
    }
    setPhase("visible");
    closeTimer.current = window.setTimeout(dismiss, timeout);
    return () => {
      window.clearTimeout(closeTimer.current);
      window.clearTimeout(exitTimer.current);
    };
  }, [dismiss, notice?.message, notice?.type, timeout]);

  if (!notice?.message || phase === "hidden") return null;

  return (
    <div
      className="toast-region"
      aria-live={type === "error" || type === "warning" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div
        className={`toast toast-${type} ${phase === "exiting" ? "toast-exiting" : ""}`}
        role={type === "error" || type === "warning" ? "alert" : "status"}
      >
        <span className="toast-icon">{icons[type]}</span>
        <div className="toast-content">
          <strong>{titles[type]}</strong>
          <p>{notice.message}</p>
        </div>
        <CloseButton className="toast-close" onClick={dismiss} label="Dismiss notification" title="Dismiss" />
        <span className="toast-progress" style={{ animationDuration: `${timeout}ms` }} />
      </div>
    </div>
  );
}
