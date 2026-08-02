import { performance } from "node:perf_hooks";
import { filterBookingSourceRows } from "../app/features/bookings/sourceFilters.js";
import { analyzeReconciliation } from "../app/utils/reconciliation.js";

const rows = Array.from({ length: 10_000 }, (_, index) => ({
  id: `booking-${index}`,
  salesOrderId: `SO${100000 + index}`,
  dealerCode: `D${index % 300}`,
  contactFirstName: index % 10 === 0 ? "Ravi" : "Customer",
  contactLastName: `User ${index}`,
  phoneNumber: `90000${String(index).padStart(5, "0")}`,
  region: index % 2 ? "North" : "South",
  model: `Model ${index % 20}`,
  matchedStatus: ["MATCHED", "PARTIALLY MATCHED", "UNMATCHED"][index % 3],
  agingBookings: index % 30,
  avlStatus: index % 5 ? "AVAILABLE" : "NO DLR STK/NO RPOS ORDER",
  areaInputs: {
    updatedAt: index % 2 ? "2026-08-01" : "",
    expectedRetailDate: index % 4 ? "2026-08-15" : "",
    bookingCategory: index % 11 ? "Confirmed" : "Cancel"
  },
  regionalInputs: { updatedAt: index % 3 ? "2026-08-01" : "" }
}));

function measure(label, budgetMs, action) {
  action();
  const start = performance.now();
  const result = action();
  const duration = performance.now() - start;
  console.log(
    `${label}: ${duration.toFixed(1)} ms / ${budgetMs} ms (${Array.isArray(result) ? result.length : rows.length} rows)`
  );
  if (duration > budgetMs) {
    console.error(`${label} exceeded its main-thread budget`);
    process.exitCode = 1;
  }
}

measure("10k booking filter", 250, () =>
  filterBookingSourceRows(rows, { search: "ravi", region: "North", workflow: "pending" })
);
measure("10k reconciliation analysis", 500, () => analyzeReconciliation(rows));
if (!process.exitCode) console.log("Large-dataset performance budgets passed.");
