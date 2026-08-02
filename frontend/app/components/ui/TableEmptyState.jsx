"use client";

import { Inbox } from "lucide-react";

export default function TableEmptyState({ description = "No records are available.", title = "No data found" }) {
  return (
    <div className="table-empty-state">
      <Inbox className="table-empty-watermark" aria-hidden="true" />
      <div className="table-empty-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </div>
  );
}
