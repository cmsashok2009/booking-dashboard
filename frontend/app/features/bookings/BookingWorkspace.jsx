"use client";

import Button from "../../components/ui/Button";
import { Tab, TabList } from "../../components/ui/Tabs";
import BookingSourcePanel from "./BookingSourcePanel";
import BookingWorkflowPanel from "./BookingWorkflowPanel";

export default function BookingWorkspace({ view, canAdmin, workflow, source, onViewChange, onDownload, onOpenUpload }) {
  return (
    <>
      <section className="booking-workspace-bar" aria-label="Booking workspace controls">
        <TabList className="booking-view-tabs" label="Booking data views">
          <Tab
            selected={view === "workflow"}
            controls="booking-workflow-panel"
            onClick={() => onViewChange("workflow")}
          >
            Workflow view
          </Tab>
          {canAdmin ? (
            <Tab selected={view === "excel"} controls="booking-excel-panel" onClick={() => onViewChange("excel")}>
              Excel source view
            </Tab>
          ) : null}
        </TabList>
        {canAdmin ? (
          <div className="booking-workspace-actions">
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
      </section>
      {view === "excel" && canAdmin ? <BookingSourcePanel {...source} /> : <BookingWorkflowPanel {...workflow} />}
    </>
  );
}
