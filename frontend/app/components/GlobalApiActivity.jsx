"use client";

import { useEffect, useState } from "react";
import Loader from "./ui/Loader";

export default function GlobalApiActivity() {
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const started = () => setPending((count) => count + 1);
    const finished = () => setPending((count) => Math.max(0, count - 1));
    window.addEventListener("booking-api-start", started);
    window.addEventListener("booking-api-end", finished);
    return () => {
      window.removeEventListener("booking-api-start", started);
      window.removeEventListener("booking-api-end", finished);
    };
  }, []);
  return pending ? (
    <div className="global-api-activity">
      <Loader label="Updating information" size="sm" inline />
    </div>
  ) : null;
}
