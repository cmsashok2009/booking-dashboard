const BOOKING_UPLOAD_HEADERS = [
  "Dealer Code",
  "Contact First Name",
  "Contact Last Name",
  "Institution Name",
  "Phone Number",
  "Sales Order Id",
  "Creation Date",
  "Dlr GRP",
  "AM",
  "Region",
  "Category",
  "MODEL",
  "VARIANT",
  "Color mapped",
  "CAT",
  "VINYEAR",
  "matching vin stock",
  "MATCHED STATUS",
  "AGING BOOKINFS",
  "AVL STATUS",
  "RPOS ORDER STATUS",
  "RPASS BKG",
  "COMB1",
];

const USER_UPLOAD_HEADERS = [
  "Name",
  "Email",
  "Phone",
  "Role",
  "Region",
  "Dealer Code",
  "Reporting Manager Email",
  "Status",
];

export function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (!rows.length) return { headers: [], rows: [] };

  const headers = rows[0].map((header) => header.trim());
  return {
    headers,
    rows: rows
      .slice(1)
      .map((values) =>
        Object.fromEntries(
          headers.map((header, index) => [
            header,
            (values[index] || "").trim(),
          ]),
        ),
      ),
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(headers, rows) {
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(","),
    ),
  ].join("\n");
}

export function pad(value, length = 3) {
  return String(value).padStart(length, "0");
}

export function createMockBookingRows(count = 100) {
  const regions = ["West", "North", "South", "East", "Central"];
  const models = ["New DUSTER", "KIGER", "TRIBER", "KWID"];
  const variants = [
    "DUSTER ADVENTURE TCE 160 MT",
    "KIGER RXZ TURBO CVT",
    "TRIBER RXZ EASY-R AMT",
    "KWID CLIMBER AMT",
  ];
  const colors = ["PWHITE", "MRED", "BLACK", "SILVER", "BLUE"];
  const avlStatuses = [
    "NO DLR STK/NO RPOS ORDER",
    "DEALER STOCK AVAILABLE",
    "RPOS ORDER AVAILABLE",
    "VIN ALLOCATED",
  ];
  const rposStatuses = [
    "ORDER NOT AVL",
    "ORDER AVAILABLE",
    "ORDER TO BE PLACED",
    "PENDING APPROVAL",
  ];
  const matchedStatuses = [
    "UNMATCHED WITH DEALERSHIP STK",
    "MATCHED WITH DEALERSHIP STK",
    "PARTIALLY MATCHED",
  ];
  const firstNames = [
    "ravi",
    "meera",
    "arun",
    "kavya",
    "naveen",
    "priya",
    "suresh",
    "anita",
    "vikram",
    "deepa",
  ];
  const lastNames = [
    "kumar",
    "sharma",
    "reddy",
    "nair",
    "patel",
    "singh",
    "rao",
    "iyer",
    "das",
    "jain",
  ];

  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const model = models[index % models.length];
    const variant = variants[index % variants.length];
    const region = regions[index % regions.length];
    const dealerCode = index === 0 ? "abcd" : `DLR${pad(number)}`;
    const salesOrderId = index === 0 ? "sob12367" : `SOB${10000 + number}`;
    const day = pad((number % 25) + 1, 2);
    const month = pad((number % 6) + 1, 2);
    const dealerGroup = `GRP${pad((index % 12) + 1, 2)}`;

    return {
      "Dealer Code": dealerCode,
      "Contact First Name": firstNames[index % firstNames.length],
      "Contact Last Name": lastNames[index % lastNames.length],
      "Institution Name":
        index % 5 === 0 ? `Fleet Account ${pad(number)}` : "0",
      "Phone Number": `98${String(76000000 + number).slice(-8)}`,
      "Sales Order Id": salesOrderId,
      "Creation Date": `2026-${month}-${day}`,
      "Dlr GRP": dealerGroup,
      AM: `AM ${region}`,
      Region: region,
      Category: index % 4 === 0 ? "priority" : "open",
      MODEL: model,
      VARIANT: variant,
      "Color mapped": colors[index % colors.length],
      CAT: index % 3 === 0 ? "RETAIL" : "NEW",
      VINYEAR: index % 2 === 0 ? "VIN26" : "VIN25",
      "matching vin stock": index % 3 === 0 ? `VINSTK${pad(number)}` : "#N/A",
      "MATCHED STATUS": matchedStatuses[index % matchedStatuses.length],
      "AGING BOOKINFS": String((index % 18) + 1),
      "AVL STATUS": avlStatuses[index % avlStatuses.length],
      "RPOS ORDER STATUS": rposStatuses[index % rposStatuses.length],
      "RPASS BKG":
        index % 2 === 0 ? "NOT DUSTER RPASS BKG" : "DUSTER RPASS BKG",
      COMB1: `${dealerGroup}${model.replaceAll(" ", "")}${index % 2 === 0 ? "VIN26" : "VIN25"}${avlStatuses[index % avlStatuses.length]}`,
    };
  });
}

export function createMockUserRows(count = 50) {
  const roles = [
    "Area Manager",
    "Regional Manager",
    "All India I",
    "All India II",
    "All India",
  ];
  const regions = ["West", "North", "South", "East", "Central"];

  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const role = roles[index % roles.length];
    const region = role.startsWith("All India")
      ? "All"
      : regions[index % regions.length];
    const managerEmailByRole = {
      "Area Manager": "rm.west@example.com",
      "Regional Manager": "all.india1@example.com",
      "All India I": "all.india2@example.com",
      "All India II": "all.india@example.com",
    };
    const managerEmail = managerEmailByRole[role] || "";
    const dealerCode =
      number === 1 ? "abcd" : `DLR${pad(((number - 1) % 99) + 1)}`;

    return {
      Name: `${role} Mock ${pad(number, 2)}`,
      Email: `mock.user${pad(number, 2)}@example.com`,
      Phone: `99${String(88000000 + number).slice(-8)}`,
      Role: role,
      Region: region,
      "Dealer Code": dealerCode,
      "Reporting Manager Email": managerEmail,
      Status: "active",
    };
  });
}

export function createBookingTemplate() {
  return toCsv(BOOKING_UPLOAD_HEADERS, createMockBookingRows(100));
}

export function createUserTemplate() {
  return toCsv(USER_UPLOAD_HEADERS, createMockUserRows(50));
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function exportBookingsAsExcelHtml(bookings) {
  const columns = [
    ["dealerCode", "Dealer Code"],
    ["contactFirstName", "Contact First Name"],
    ["contactLastName", "Contact Last Name"],
    ["institutionName", "Institution Name"],
    ["phoneNumber", "Phone Number"],
    ["salesOrderId", "Sales Order Id"],
    ["creationDate", "Creation Date"],
    ["dealerGroup", "Dlr GRP"],
    ["amNameFromFile", "AM"],
    ["region", "Region"],
    ["category", "Category"],
    ["model", "MODEL"],
    ["variant", "VARIANT"],
    ["colorMapped", "Color mapped"],
    ["cat", "CAT"],
    ["vinYear", "VINYEAR"],
    ["matchingVinStock", "Matching VIN Stock"],
    ["matchedStatus", "Matched Status"],
    ["agingBookings", "Aging Bookings"],
    ["avlStatus", "AVL Status"],
    ["rposOrderStatus", "RPOS Order Status"],
    ["rpassBkg", "RPASS BKG"],
    ["comb1", "COMB1"],
  ];
  const workflowColumns = [
    ["areaInputs.bookingCategory", "Booking Category"],
    ["areaInputs.wholesalesFeedback", "Wholesales Feedback"],
    ["areaInputs.wsPlanning", "WS Planning"],
    ["areaInputs.expectedRetailDate", "Expected Retail Date"],
    [
      "areaInputs.cancellationReason",
      "Remarks for Cancellation or Not Yet Decided",
    ],
    ["regionalInputs.wholesaleInput", "Wholesale Input"],
    ["regionalInputs.retailInput", "Retail Input"],
    ["areaInputs.updatedBy", "Last Area Updated By"],
    ["areaInputs.updatedAt", "Last Area Updated At"],
    ["regionalInputs.updatedBy", "Last Regional Updated By"],
    ["regionalInputs.updatedAt", "Last Regional Updated At"],
  ];
  const allColumns = [...columns, ...workflowColumns];
  const read = (row, key) =>
    key.split(".").reduce((value, part) => value?.[part], row) || "";

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><style>td,th{border:1px solid #999;padding:4px;}th{background:#e8eef8;}</style></head>
<body>
<table>
<thead><tr>${allColumns.map(([, label]) => `<th>${htmlEscape(label)}</th>`).join("")}</tr></thead>
<tbody>
${bookings
  .map(
    (booking) =>
      `<tr>${allColumns.map(([key]) => `<td>${htmlEscape(read(booking, key))}</td>`).join("")}</tr>`,
  )
  .join("\n")}
</tbody>
</table>
</body>
</html>`;
}
