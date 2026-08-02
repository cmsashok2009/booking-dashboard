"use client";

import { useMemo } from "react";
import { analyzeReconciliation } from "../utils/reconciliation";
import { displayValue } from "../utils/bookings";
import InfoTooltip from "./InfoTooltip";
import ReconciliationExceptions from "./ReconciliationExceptions";

function Heading({ title, tooltip, tooltipPlacement = "top" }) {
  return (
    <div className="recon-title-row">
      <h2>{title}</h2>
      <InfoTooltip label={title} placement={tooltipPlacement}>
        {tooltip}
      </InfoTooltip>
    </div>
  );
}

function CheckpointChart({ stages, total }) {
  return (
    <section className="recon-card">
      <div className="recon-card-head">
        <Heading
          title="Fulfillment health"
          tooltip="Compares all bookings with those having a supply path, a full match, or an expected retail date. These checkpoints may overlap."
        />
        <p>Independent checkpoints across the assigned booking book</p>
      </div>
      <div className="checkpoint-chart">
        {stages.map((stage, index) => {
          const percentage = total ? Math.round((stage.value / total) * 100) : 0;
          return (
            <div className="checkpoint-row" key={stage.label}>
              <div>
                <span>{stage.label}</span>
                <strong>
                  {stage.value} <small>{percentage}%</small>
                </strong>
              </div>
              <div className="checkpoint-track">
                <span className={`checkpoint-fill checkpoint-fill-${index}`} style={{ width: `${percentage}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="chart-note">Checkpoints can overlap. A retail date may exist before a booking is fully matched.</p>
    </section>
  );
}

function StackedModelChart({ rows }) {
  return (
    <section className="recon-card">
      <div className="recon-card-head">
        <Heading
          title="Supply status by model"
          tooltip="Shows fully matched, partially matched, and unmatched bookings for each vehicle model in the current scope."
        />
        <p>Where each model stands in fulfillment reconciliation</p>
      </div>
      <div className="stacked-legend">
        <span className="legend-matched">Fully matched</span>
        <span className="legend-partial">Partial</span>
        <span className="legend-unmatched">Unmatched</span>
      </div>
      <div className="stacked-chart">
        {rows.map((row) => (
          <div className="stacked-row" key={row.label}>
            <div className="stacked-label">
              <span>{row.label}</span>
              <strong>{row.total}</strong>
            </div>
            <div className="stacked-track">
              {row.segments.map((segment, index) => (
                <span
                  key={segment.label}
                  className={`stacked-segment stacked-segment-${index}`}
                  style={{ width: `${row.total ? (segment.value / row.total) * 100 : 0}%` }}
                  title={`${segment.label}: ${segment.value}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HeatmapChart({ data }) {
  const maximum = Math.max(1, ...data.rows.flatMap((row) => row.values));
  return (
    <section className="recon-card heatmap-card">
      <div className="recon-card-head">
        <Heading
          title="Reconciliation heatmap"
          tooltipPlacement="bottom"
          tooltip="Read across a model row to compare its booking counts by match status. Darker blue cells indicate a higher number of bookings."
        />
        <p>Compare fulfillment status and booking volume for each vehicle model.</p>
      </div>
      <div
        className="heatmap-grid"
        role="grid"
        aria-label="Booking counts by vehicle model and reconciliation status"
        style={{ gridTemplateColumns: `minmax(100px, 1.2fr) repeat(${data.columns.length}, minmax(76px, 1fr))` }}
      >
        <div className="heatmap-grid-row" role="row">
          <span className="heatmap-corner" role="columnheader">
            Model
          </span>
          {data.columns.map((column) => (
            <strong role="columnheader" key={column}>
              {column}
            </strong>
          ))}
        </div>
        {data.rows.map((row) => (
          <div className="heatmap-grid-row" role="row" key={row.label}>
            <strong className="heatmap-row-label" role="rowheader">
              {row.label}
            </strong>
            {row.values.map((value, index) => {
              const status = data.columns[index];
              const percentageOfMaximum = Math.round((value / maximum) * 100);
              const tooltip = `${row.label} - ${status}: ${value} booking${value === 1 ? "" : "s"}. Color intensity is ${percentageOfMaximum}% of the highest-volume cell.`;
              return (
                <span
                  className="heatmap-cell"
                  role="gridcell"
                  tabIndex="0"
                  title={tooltip}
                  aria-label={tooltip}
                  key={`${row.label}-${status}`}
                  style={{ backgroundColor: `rgba(40, 100, 183, ${0.1 + (value / maximum) * 0.72})` }}
                >
                  {value}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="heatmap-explainer">
        <strong>How to read:</strong> choose a model row, then compare the status columns. Each number is a booking
        count; darker blue means more bookings. Hover or focus a cell for details.
      </p>
    </section>
  );
}

function AgingHistogram({ bins }) {
  const maximum = Math.max(1, ...bins.map((bin) => bin.value));
  return (
    <section className="recon-card">
      <div className="recon-card-head">
        <Heading
          title="Backlog aging"
          tooltip="Groups bookings by days waiting for reconciliation. The 14+ day group is the oldest backlog and requires closer monitoring."
        />
        <p>Days waiting for reconciliation</p>
      </div>
      <div className="histogram" role="img" aria-label="Booking aging histogram">
        {bins.map((bin) => (
          <div className="histogram-bin" key={bin.label}>
            <strong>{bin.value}</strong>
            <div className="histogram-column">
              <span
                className={bin.alert ? "histogram-alert" : ""}
                style={{ height: `${(bin.value / maximum) * 100}%` }}
              />
            </div>
            <small>{bin.label} days</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function SignalChart({ items, total }) {
  return (
    <section className="recon-card signal-card">
      <div className="recon-card-head">
        <Heading
          title="Commitment signals"
          tooltip="Summarizes retail dates, wholesale direction, cancellation intent, and missing disposition. A booking may appear in more than one signal."
        />
        <p>Customer direction and forward retail commitments</p>
      </div>
      <div className="signal-chart">
        {items.map((item) => {
          const percentage = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <div className="signal-row" key={item.label}>
              <div>
                <span>{item.label}</span>
                <strong>
                  {item.value} <small>{percentage}%</small>
                </strong>
              </div>
              <div className="signal-track">
                <span className={`signal-fill signal-${item.tone}`} style={{ width: `${percentage}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="chart-note">Signals may overlap on the same booking and should be reviewed independently.</p>
    </section>
  );
}

function InsightNarrative({ insights, limit }) {
  const visibleInsights = typeof limit === "number" ? insights.slice(0, limit) : insights;
  return (
    <section className="recon-card insight-narrative">
      <div className="recon-card-head">
        <Heading
          title="Operational insights"
          tooltip="Automatically calculated observations based only on bookings visible to the signed-in role."
        />
        <p>Calculated from the current role-scoped booking view</p>
      </div>
      <div className="insight-summary-grid">
        {visibleInsights.map((insight, index) => (
          <article key={insight.title}>
            <span>{index + 1}</span>
            <div>
              <strong>{insight.title}</strong>
              <p>{insight.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function ReconciliationDashboard({ bookings, onOpenBooking, mode = "admin", viewerRole = "" }) {
  const analysis = useMemo(() => analyzeReconciliation(bookings), [bookings]);
  const managerMode = mode === "manager";
  return (
    <div className={`reconciliation-dashboard ${managerMode ? "manager-dashboard" : "admin-dashboard"}`}>
      <div className="reconciliation-heading">
        <div>
          <Heading
            title="Fulfillment overview"
            tooltip="A role-scoped view of where bookings are progressing or becoming blocked across supply, aging, and customer commitment."
          />
          <p>Where assigned bookings need attention across supply, aging and customer commitment.</p>
        </div>
        <span>{analysis.total} bookings in scope</span>
      </div>
      <ReconciliationExceptions
        rows={analysis.exceptions}
        onOpenBooking={onOpenBooking}
        viewerRole={viewerRole}
        Heading={Heading}
      />
      {managerMode ? (
        <>
          <div className="recon-grid recon-manager-primary">
            <CheckpointChart stages={analysis.funnel} total={analysis.total} />
            <AgingHistogram bins={analysis.agingBins} />
          </div>
          <div className="recon-grid recon-manager-secondary">
            <StackedModelChart rows={analysis.modelFulfillment} />
            <SignalChart items={analysis.signals} total={analysis.total} />
          </div>
          <InsightNarrative insights={analysis.insights} limit={4} />
        </>
      ) : (
        <>
          <div className="recon-grid recon-grid-primary">
            <CheckpointChart stages={analysis.funnel} total={analysis.total} />
            <StackedModelChart rows={analysis.modelFulfillment} />
          </div>
          <div className="recon-grid recon-grid-secondary">
            <HeatmapChart data={analysis.heatmap} />
            <AgingHistogram bins={analysis.agingBins} />
            <SignalChart items={analysis.signals} total={analysis.total} />
          </div>
          <InsightNarrative insights={analysis.insights} />
        </>
      )}
    </div>
  );
}
