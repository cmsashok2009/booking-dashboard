import { buildDistribution, isWorkflowPending } from "../../utils/bookings.js";

export function buildDashboardMetrics(bookings) {
  const total = bookings.length;
  const areaDone = bookings.filter((booking) => booking.areaInputs?.updatedAt).length;
  const regionalDone = bookings.filter((booking) => booking.regionalInputs?.updatedAt).length;
  const completed = bookings.filter(
    (booking) => booking.areaInputs?.updatedAt && booking.regionalInputs?.updatedAt
  ).length;
  const notStarted = bookings.filter(
    (booking) => !booking.areaInputs?.updatedAt && !booking.regionalInputs?.updatedAt
  ).length;
  const sequenceGaps = bookings.filter(
    (booking) => !booking.areaInputs?.updatedAt && booking.regionalInputs?.updatedAt
  ).length;
  return [
    { label: "Bookings", value: total, tone: "blue", filter: "all", helper: "All imported booking rows" },
    {
      label: "Area Updated",
      value: areaDone,
      tone: "teal",
      filter: "area-updated",
      helper: `${total - areaDone} awaiting AM update`
    },
    {
      label: "Regional Updated",
      value: regionalDone,
      tone: "blue",
      filter: "regional-updated",
      helper: `${total - regionalDone} awaiting RM update`
    },
    {
      label: "Fully Complete",
      value: completed,
      tone: "green",
      filter: "fully-complete",
      helper: "Both AM and RM updates submitted"
    },
    {
      label: "Needs Attention",
      value: total - completed,
      tone: "amber",
      filter: "needs-attention",
      helper: `${notStarted} not started | ${sequenceGaps} sequence gaps`
    }
  ];
}

export function buildDashboardInsights(bookings, isAdmin) {
  const total = bookings.length;
  const areaUpdated = bookings.filter((booking) => booking.areaInputs?.updatedAt).length;
  const regionalUpdated = bookings.filter((booking) => booking.regionalInputs?.updatedAt).length;
  const completed = bookings.filter(
    (booking) => booking.areaInputs?.updatedAt && booking.regionalInputs?.updatedAt
  ).length;
  const pending = bookings.filter(isWorkflowPending).length;

  if (isAdmin) {
    const areaName = (booking) => booking.amNameFromFile || booking.region || "Unassigned";
    const groups = bookings.reduce((result, booking) => {
      const name = areaName(booking);
      if (!result.has(name)) result.set(name, []);
      result.get(name).push(booking);
      return result;
    }, new Map());
    const pendingRows = bookings.filter(isWorkflowPending);
    const completionByArea = [...groups.entries()]
      .map(([label, rows]) => {
        const count = rows.filter(
          (booking) => booking.areaInputs?.updatedAt && booking.regionalInputs?.updatedAt
        ).length;
        return {
          label,
          value: count,
          displayValue: `${count}/${rows.length}`,
          percentage: rows.length ? Math.round((count / rows.length) * 100) : 0,
          tone: "green"
        };
      })
      .sort((left, right) => right.percentage - left.percentage || left.label.localeCompare(right.label));
    return [
      {
        title: "Bookings by area",
        subtitle: "Distribution across Area Manager territories",
        total,
        items: buildDistribution(bookings, areaName).map((item) => ({ ...item, tone: "blue" }))
      },
      {
        title: "Pending workflow by area",
        subtitle: "Areas requiring AM or RM action",
        total: pendingRows.length,
        items: buildDistribution(pendingRows, areaName).map((item) => ({ ...item, tone: "amber" }))
      },
      {
        title: "Completion rate by area",
        subtitle: "Bookings completed by both AM and RM",
        total,
        items: completionByArea
      }
    ];
  }

  return [
    {
      title: "Workflow completion",
      subtitle: "Progress across assigned bookings",
      total,
      items: [
        { label: "Area updated", value: areaUpdated, tone: "teal" },
        { label: "Regional updated", value: regionalUpdated, tone: "green" },
        { label: "Fully completed", value: completed, tone: "blue" },
        { label: "Pending action", value: pending, tone: "amber" }
      ]
    },
    {
      title: "Booking categories",
      subtitle: "Current Area Manager classification",
      total,
      items: buildDistribution(bookings, (booking) => booking.areaInputs?.bookingCategory).map((item) => ({
        ...item,
        tone: "blue"
      }))
    },
    {
      title: "Availability status",
      subtitle: "Vehicle availability across bookings",
      total,
      items: buildDistribution(bookings, (booking) => booking.avlStatus).map((item) => ({ ...item, tone: "amber" }))
    }
  ];
}
