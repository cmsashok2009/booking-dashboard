"use client";

import Button from "../../components/ui/Button";
import TabbedWorkspace from "../../components/ui/TabbedWorkspace";
import BookingSourcePanel from "./BookingSourcePanel";
import BookingWorkflowPanel from "./BookingWorkflowPanel";

export default function BookingWorkspace({ view, canAdmin, workflow, source, onViewChange, onDownload, onOpenUpload }) {
  const activeView = canAdmin && view === "excel" ? "excel" : "workflow";
  const groups = [
    {
      id: "views",
      label: "Booking views",
      items: [
        { value: "workflow", label: "Workflow view" },
        ...(canAdmin ? [{ value: "excel", label: "Excel source view" }] : [])
      ]
    }
  ];

  return (
    <TabbedWorkspace
      label="Booking management"
      groups={groups}
      value={activeView}
      onChange={onViewChange}
      idPrefix="booking-management"
      className="booking-tabbed-workspace"
      canvasClassName="booking-management-canvas"
    >
      {canAdmin ? (
        <div className="booking-canvas-actions">
          <Button variant="secondary" className="action-with-icon" type="button" onClick={onDownload}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17">
              <path
                d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Export
          </Button>
          <Button className="action-with-icon" type="button" onClick={onOpenUpload}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17">
              <path
                d="M12 16V4m0 0L8 8m4-4 4 4M5 19h14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Upload bookings
          </Button>
        </div>
      ) : null}
      {activeView === "excel" ? <BookingSourcePanel {...source} /> : <BookingWorkflowPanel {...workflow} />}
    </TabbedWorkspace>
  );
}
