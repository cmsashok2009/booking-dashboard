function normalized(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function agingDays(booking) {
  const value = Number.parseFloat(booking.agingBookings);
  return Number.isFinite(value) ? value : 0;
}

export function matchBucket(booking) {
  const status = normalized(booking.matchedStatus);
  if (status.startsWith("PARTIALLY")) return "Partially matched";
  if (status.startsWith("UNMATCHED")) return "Unmatched";
  if (status.startsWith("MATCHED")) return "Fully matched";
  return "Unknown";
}

export function hasSupplyPath(booking) {
  const availability = normalized(booking.avlStatus);
  return Boolean(availability && !availability.includes("NO DLR STK/NO RPOS ORDER"));
}

function disposition(booking) {
  const category = normalized(booking.areaInputs?.bookingCategory);
  const planning = normalized(booking.areaInputs?.wsPlanning);
  const wholesale = normalized(booking.areaInputs?.wholesalesFeedback);
  if (category.includes("CANCEL") || planning.includes("CANCEL")) return "To be cancelled";
  if (wholesale.includes("WHOLESALE") && !wholesale.includes("NOT")) return "Wholesale";
  if (booking.areaInputs?.expectedRetailDate) return "Retail committed";
  return "Undecided";
}

function groupCounts(rows, valueSelector) {
  return rows.reduce((counts, row) => {
    const value = valueSelector(row) || "Unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function average(rows, valueSelector) {
  if (!rows.length) return 0;
  return rows.reduce((total, row) => total + valueSelector(row), 0) / rows.length;
}

export function analyzeReconciliation(bookings) {
  const total = bookings.length;
  const supplyRows = bookings.filter(hasSupplyPath);
  const fullyMatchedRows = bookings.filter((booking) => matchBucket(booking) === "Fully matched");
  const retailCommittedRows = bookings.filter((booking) => booking.areaInputs?.expectedRetailDate);
  const noSupplyRows = bookings.filter((booking) => !hasSupplyPath(booking));
  const modelNames = [...new Set(bookings.map((booking) => booking.model || "Unknown"))].sort();
  const matchStatuses = ["Fully matched", "Partially matched", "Unmatched"];
  const modelFulfillment = modelNames.map((model) => {
    const rows = bookings.filter((booking) => (booking.model || "Unknown") === model);
    return {
      label: model,
      total: rows.length,
      segments: matchStatuses.map((label) => ({
        label,
        value: rows.filter((booking) => matchBucket(booking) === label).length
      }))
    };
  });
  const heatmap = modelNames.map((model) => ({
    label: model,
    values: matchStatuses.map(
      (status) =>
        bookings.filter((booking) => (booking.model || "Unknown") === model && matchBucket(booking) === status).length
    )
  }));
  const agingBins = [
    { label: "0-3", value: bookings.filter((booking) => agingDays(booking) <= 3).length },
    { label: "4-7", value: bookings.filter((booking) => agingDays(booking) >= 4 && agingDays(booking) <= 7).length },
    { label: "8-13", value: bookings.filter((booking) => agingDays(booking) >= 8 && agingDays(booking) <= 13).length },
    { label: "14+", value: bookings.filter((booking) => agingDays(booking) >= 14).length, alert: true }
  ];
  const wholesaleRows = bookings.filter((booking) =>
    normalized(booking.areaInputs?.wholesalesFeedback).includes("TO BE WHOLESALED")
  );
  const cancelledRows = bookings.filter(
    (booking) =>
      normalized(booking.areaInputs?.bookingCategory).includes("CANCEL") ||
      normalized(booking.areaInputs?.wsPlanning).includes("CANCEL")
  );
  const unclassifiedRows = bookings.filter(
    (booking) =>
      !booking.areaInputs?.bookingCategory &&
      !booking.areaInputs?.wholesalesFeedback &&
      !booking.areaInputs?.expectedRetailDate
  );
  const exceptions = noSupplyRows
    .filter((booking) => agingDays(booking) >= 14)
    .sort((left, right) => agingDays(right) - agingDays(left))
    .slice(0, 10);
  const fullyMatched = bookings.filter((booking) => matchBucket(booking) === "Fully matched");
  const partial = bookings.filter((booking) => matchBucket(booking) === "Partially matched");
  const unmatched = bookings.filter((booking) => matchBucket(booking) === "Unmatched");
  const cancelled = cancelledRows;
  const dated = bookings.filter((booking) => booking.areaInputs?.expectedRetailDate);
  const noSupplyModels = groupCounts(noSupplyRows, (booking) => booking.model || "Unknown");
  const dominantNoSupplyModel = Object.entries(noSupplyModels).sort((left, right) => right[1] - left[1])[0];
  const percent = (value) => (total ? Math.round((value / total) * 100) : 0);
  return {
    total,
    funnel: [
      { label: "Bookings", value: total },
      { label: "Supply path identified", value: supplyRows.length },
      { label: "Fully matched", value: fullyMatchedRows.length },
      { label: "Retail date committed", value: retailCommittedRows.length }
    ],
    supplyPathCount: supplyRows.length,
    fullyMatchedCount: fullyMatchedRows.length,
    retailCommittedCount: retailCommittedRows.length,
    noSupplyCount: noSupplyRows.length,
    modelFulfillment,
    heatmap: { columns: matchStatuses, rows: heatmap },
    agingBins,
    signals: [
      { label: "Expected Retail Date set", value: retailCommittedRows.length, tone: "blue" },
      { label: "To be wholesaled", value: wholesaleRows.length, tone: "teal" },
      { label: "To be cancelled", value: cancelledRows.length, tone: "amber" },
      { label: "No disposition entered", value: unclassifiedRows.length, tone: "gray" }
    ],
    exceptions,
    insights: [
      {
        title: `${percent(fullyMatched.length)}% of bookings are fully matched to stock.`,
        detail: `${fullyMatched.length} of ${total} bookings are fully reconciled; this is the core booking-to-fulfillment health measure.`
      },
      {
        title: `${noSupplyRows.length} bookings have no confirmed supply path.`,
        detail: dominantNoSupplyModel
          ? dominantNoSupplyModel[1] === noSupplyRows.length
            ? `${dominantNoSupplyModel[0]} accounts for all ${noSupplyRows.length} unsupported bookings (100%).`
            : `${dominantNoSupplyModel[0]} contributes the largest share (${dominantNoSupplyModel[1]} bookings).`
          : "No unsupported bookings are currently present."
      },
      {
        title: `${percent(cancelled.length)}% of bookings are marked for cancellation.`,
        detail: `${cancelled.length} bookings are currently expected to leave the conversion funnel.`
      },
      {
        title: `Average backlog age is ${average(bookings, agingDays).toFixed(1)} days.`,
        detail: `${bookings.filter((booking) => agingDays(booking) >= 14).length} bookings have been waiting for 14 days or more.`
      },
      {
        title: `Partial matches average ${average(partial, agingDays).toFixed(1)} days versus ${average(unmatched, agingDays).toFixed(1)} days unmatched.`,
        detail: partial.length
          ? "A higher partial-match age can indicate a manual reconciliation or final approval bottleneck."
          : "There are no partial matches in the current view."
      },
      {
        title: `${dated.length} bookings have an Expected Retail Date.`,
        detail: `${total - dated.length} bookings still have no forward retail commitment recorded.`
      }
    ]
  };
}
