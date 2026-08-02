const state = {
  user: null,
  activeView: "dashboard",
  bootstrap: null,
  bookings: [],
  allBookings: [],
  selectedBooking: null,
  detailFilter: "all",
  bookingPage: 1,
  excelPage: 1,
  pageSize: 10,
  bookingFilters: {
    search: "",
    region: "",
    wholesaleInput: "",
    retailInput: ""
  },
  uploadPreview: null,
  pendingBookingUpload: null,
  selectedAreaField: "bookingCategory",
  userTable: {
    search: "",
    role: "",
    status: "",
    region: "",
    sortKey: "name",
    sortDir: "asc"
  },
  addOptionModalOpen: false,
  notice: null
};

const excelColumns = [
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
  ["matchingVinStock", "matching vin stock"],
  ["matchedStatus", "MATCHED STATUS"],
  ["agingBookings", "AGING BOOKINFS"],
  ["avlStatus", "AVL STATUS"],
  ["rposOrderStatus", "RPOS ORDER STATUS"],
  ["rpassBkg", "RPASS BKG"],
  ["comb1", "COMB1"],
  ["areaInputs.bookingCategory", "Booking Category"],
  ["areaInputs.wholesalesFeedback", "Wholesales Feedback"],
  ["areaInputs.wsPlanning", "WS Planning"],
  ["areaInputs.expectedRetailDate", "Expected Retail Date"],
  ["areaInputs.cancellationReason", "Remarks"],
  ["regionalInputs.wholesaleInput", "Wholesale Input"],
  ["regionalInputs.retailInput", "Retail Input"]
];

const app = document.querySelector("#app");

const api = {
  async get(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error((await response.json()).error || response.statusText);
    return response.json();
  },
  async post(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw Object.assign(new Error(payload.error || "Request failed"), { payload });
    return payload;
  },
  async patch(path, body) {
    const response = await fetch(path, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw Object.assign(new Error(payload.error || "Request failed"), { payload });
    return payload;
  }
};

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function readPath(row, key) {
  return key.split(".").reduce((value, part) => value?.[part], row) || "";
}

function parseCsvPreview(input) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === "\"" && insideQuotes && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
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
  return {
    headers: rows[0] || [],
    rows: rows.slice(1, 11)
  };
}

function setNotice(message, type = "success") {
  state.notice = { message, type };
  render();
}

function canAdmin() {
  return state.user?.role === "Admin";
}

function canAreaEdit() {
  return state.user?.role === "Area Manager";
}

function canRegionalEdit() {
  return state.user?.role === "Regional Manager";
}

async function loadBootstrap() {
  state.bootstrap = await api.get("/api/bootstrap");
}

async function loadBookings() {
  const params = new URLSearchParams({
    role: state.user?.role || "",
    userId: state.user?.id || "",
    search: state.bookingFilters.search,
    region: state.bookingFilters.region,
    wholesaleInput: state.bookingFilters.wholesaleInput,
    retailInput: state.bookingFilters.retailInput
  });
  const payload = await api.get(`/api/bookings?${params}`);
  state.allBookings = payload.rows;
  state.bookings = applyDetailFilter(payload.rows);
}

function applyDetailFilter(rows) {
  if (state.detailFilter === "area-updated") return rows.filter((booking) => booking.areaInputs?.updatedAt);
  if (state.detailFilter === "regional-updated") return rows.filter((booking) => booking.regionalInputs?.updatedAt);
  if (state.detailFilter === "pending") return rows.filter((booking) => !booking.areaInputs?.updatedAt || !booking.regionalInputs?.updatedAt);
  return rows;
}

async function login(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    const payload = await api.post("/api/auth/login", {
      email: form.get("email"),
      password: form.get("password")
    });
    state.user = payload.user;
    state.activeView = "dashboard";
    state.notice = null;
    await loadBootstrap();
    await loadBookings();
    render();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

function logout() {
  state.user = null;
  state.selectedBooking = null;
  state.notice = null;
  render();
}

function metricData() {
  const total = state.bookings.length;
  const areaDone = state.bookings.filter((booking) => booking.areaInputs?.updatedAt).length;
  const regionalDone = state.bookings.filter((booking) => booking.regionalInputs?.updatedAt).length;
  const pending = state.bookings.filter((booking) => !booking.areaInputs?.updatedAt || !booking.regionalInputs?.updatedAt).length;
  return [
    { label: "Bookings", value: total, tone: "", filter: "all", helper: "All imported booking rows" },
    { label: "Area Updated", value: areaDone, tone: "ok", filter: "area-updated", helper: "Rows where AM submitted updates" },
    { label: "Regional Updated", value: regionalDone, tone: "ok", filter: "regional-updated", helper: "Rows where RM submitted inputs" },
    { label: "Pending Workflow", value: pending, tone: "warn", filter: "pending", helper: "Rows missing AM or RM updates" }
  ];
}

function detailTitle() {
  return {
    all: "All Bookings",
    "area-updated": "Area Updated Bookings",
    "regional-updated": "Regional Updated Bookings",
    pending: "Pending Workflow Bookings"
  }[state.detailFilter] || "All Bookings";
}

function paginatedRows(rows, pageKey) {
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / state.pageSize));
  state[pageKey] = Math.min(Math.max(1, state[pageKey] || 1), totalPages);
  const startIndex = (state[pageKey] - 1) * state.pageSize;
  return {
    rows: rows.slice(startIndex, startIndex + state.pageSize),
    page: state[pageKey],
    totalPages,
    totalRows,
    start: totalRows ? startIndex + 1 : 0,
    end: Math.min(startIndex + state.pageSize, totalRows)
  };
}

function paginationItems(currentPage, totalPages) {
  const pages = new Set([1, 2, 3, totalPages - 2, totalPages - 1, totalPages]);
  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    pages.add(page);
  }
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  return sorted.flatMap((page, index) => {
    const previous = sorted[index - 1];
    return index > 0 && page - previous > 1 ? ["ellipsis", page] : [page];
  });
}

function renderPagination(pageKey, pageData) {
  return `
    <div class="pagination">
      <span>${pageData.start}-${pageData.end} of ${pageData.totalRows}</span>
      <div class="pagination-actions">
        <button class="secondary icon-page" data-page-key="${pageKey}" data-page-action="first" title="First page" aria-label="First page" ${pageData.page <= 1 ? "disabled" : ""}>«</button>
        <button class="secondary icon-page" data-page-key="${pageKey}" data-page-action="prev" title="Previous page" aria-label="Previous page" ${pageData.page <= 1 ? "disabled" : ""}>‹</button>
        ${paginationItems(pageData.page, pageData.totalPages)
          .map((item) =>
            item === "ellipsis"
              ? `<span class="page-ellipsis">...</span>`
              : `<button class="secondary page-number ${item === pageData.page ? "active" : ""}" data-page-key="${pageKey}" data-page-number="${item}" ${item === pageData.page ? "disabled" : ""}>${item}</button>`
          )
          .join("")}
        <button class="secondary icon-page" data-page-key="${pageKey}" data-page-action="next" title="Next page" aria-label="Next page" ${pageData.page >= pageData.totalPages ? "disabled" : ""}>›</button>
        <button class="secondary icon-page" data-page-key="${pageKey}" data-page-action="last" title="Last page" aria-label="Last page" ${pageData.page >= pageData.totalPages ? "disabled" : ""}>»</button>
      </div>
    </div>
  `;
}

function renderLogin() {
  app.innerHTML = `
    <main class="login">
      <section class="login-card">
        <h1>Booking Dashboard</h1>
        <p>Role-based booking workflow prototype.</p>
        ${state.notice ? `<div class="notice ${state.notice.type}">${html(state.notice.message)}</div>` : ""}
        <form id="loginForm">
          <div class="field">
            <label>Email</label>
            <select name="email">
              <option value="admin@example.com">admin@example.com - Admin</option>
              <option value="am.west@example.com">am.west@example.com - Area Manager</option>
              <option value="rm.west@example.com">rm.west@example.com - Regional Manager</option>
              <option value="all.india@example.com">all.india@example.com - All India</option>
            </select>
          </div>
          <div class="field">
            <label>Password</label>
            <input name="password" type="password" value="Password@123" />
          </div>
          <button>Login</button>
        </form>
        <div class="hint-list">
          Demo password for seeded users: <code>Password@123</code>
        </div>
      </section>
    </main>
  `;
  document.querySelector("#loginForm").addEventListener("submit", login);
}

function navButton(view, label) {
  return `<button class="${state.activeView === view ? "active" : ""}" data-view="${view}">${label}</button>`;
}

function userInitials(user) {
  return String(user?.name || user?.email || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function renderShell(content) {
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">Booking Dashboard</div>
        <nav class="nav">
          ${navButton("dashboard", "Dashboard")}
          ${navButton("bookings", "Bookings")}
          ${canAdmin() ? navButton("area-fields", "Area Fields") : ""}
          ${canAdmin() ? navButton("users", "Users") : ""}
        </nav>
      </aside>
      <main class="main">
        ${content}
      </main>
    </div>
    ${state.selectedBooking ? renderBookingModal(state.selectedBooking) : ""}
    ${state.addOptionModalOpen ? renderAddOptionModal() : ""}
  `;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.activeView = button.dataset.view;
      if (["dashboard", "bookings"].includes(state.activeView)) state.detailFilter = "all";
      state.bookingPage = 1;
      state.excelPage = 1;
      state.notice = null;
      await loadBookings();
      render();
    });
  });
  document.querySelector("#topLogoutBtn")?.addEventListener("click", logout);
  bindCommonEvents();
}

function renderTopbar(title, subtitle) {
  return `
    <div class="topbar">
      <div class="title">
        <h1>${html(title)}</h1>
        <p>${html(subtitle)}</p>
      </div>
      <div class="actions">
        <button class="icon-button" id="notificationBtn" title="Notifications" aria-label="Notifications">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="notification-dot"></span>
        </button>
        <div class="profile-pill" title="${html(state.user.email)}">
          <span class="avatar">${html(userInitials(state.user))}</span>
          <span>
            <strong>${html(state.user.name)}</strong>
            <small>${html(state.user.role)} · ${html(state.user.region || "All")}</small>
          </span>
        </div>
        <button class="secondary" id="topLogoutBtn">Logout</button>
      </div>
    </div>
    ${state.notice ? `<div class="notice ${state.notice.type}">${html(state.notice.message)}</div>` : ""}
  `;
}

function renderDashboard() {
  const metrics = metricData()
    .map(
      (metric) => `
        <button class="card metric-link" data-metric-filter="${metric.filter}" title="Open ${html(metric.label)} details">
          <div class="label">${html(metric.label)}</div>
          <div class="value"><span class="badge ${metric.tone}">${metric.value}</span></div>
          <small>${html(metric.helper)}</small>
        </button>
      `
    )
    .join("");

  return `
    ${renderTopbar("Dashboard", "Latest booking data from the mock backend store.")}
    <div class="grid metrics">${metrics}</div>
    ${renderBookingsPanel("Recent Bookings")}
  `;
}

function renderBookingsPanel(title = "Bookings") {
  const activeTitle = title === "Bookings" ? detailTitle() : title;
  const pageData = paginatedRows(state.bookings, "bookingPage");
  return `
    <section class="panel">
      <h2>${html(activeTitle)}</h2>
      <div class="toolbar">
        <input id="search" value="${html(state.bookingFilters.search)}" placeholder="Search booking, customer, wholesale, retail" />
        <select id="regionFilter">
          <option value="">All regions</option>
          ${(state.bootstrap?.regions || []).map((region) => `<option value="${html(region)}" ${state.bookingFilters.region === region ? "selected" : ""}>${html(region)}</option>`).join("")}
        </select>
        <select id="wholesaleInputFilter">
          <option value="">All wholesale input</option>
          <option value="filled" ${state.bookingFilters.wholesaleInput === "filled" ? "selected" : ""}>Wholesale filled</option>
          <option value="missing" ${state.bookingFilters.wholesaleInput === "missing" ? "selected" : ""}>Wholesale missing</option>
        </select>
        <select id="retailInputFilter">
          <option value="">All retail input</option>
          <option value="filled" ${state.bookingFilters.retailInput === "filled" ? "selected" : ""}>Retail filled</option>
          <option value="missing" ${state.bookingFilters.retailInput === "missing" ? "selected" : ""}>Retail missing</option>
        </select>
        ${state.detailFilter !== "all" ? `<button class="secondary" id="clearDetailFilter">Show All Bookings</button>` : ""}
        <button class="secondary" id="refreshBookings">Refresh</button>
      </div>
      <div class="table-wrap">
        <table class="bookings-table">
          <thead>
            <tr>
              <th class="sticky-col sticky-sales">Sales Order</th>
              <th class="sticky-col sticky-dealer">Dealer</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Region</th>
              <th>Model</th>
              <th>Variant</th>
              <th>AVL Status</th>
              <th>Booking Category</th>
              <th>WS Planning</th>
              <th class="wide-input-col">Wholesale Input</th>
              <th class="wide-input-col">Retail Input</th>
              <th class="sticky-action">Action</th>
            </tr>
          </thead>
          <tbody>
            ${pageData.rows.map(renderBookingRow).join("") || `<tr><td colspan="13">No records found.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${renderPagination("bookingPage", pageData)}
    </section>
  `;
}

function renderBookingRow(booking) {
  return `
    <tr>
      <td class="sticky-col sticky-sales">${html(booking.salesOrderId)}</td>
      <td class="sticky-col sticky-dealer">${html(booking.dealerCode)}</td>
      <td>${html(`${booking.contactFirstName} ${booking.contactLastName}`)}</td>
      <td>${html(booking.phoneNumber)}</td>
      <td>${html(booking.region)}</td>
      <td>${html(booking.model)}</td>
      <td>${html(booking.variant)}</td>
      <td><span class="badge warn">${html(booking.avlStatus)}</span></td>
      <td>${html(booking.areaInputs?.bookingCategory || "")}</td>
      <td>${html(booking.areaInputs?.wsPlanning || "")}</td>
      <td class="wide-input-col">${html(booking.regionalInputs?.wholesaleInput || "")}</td>
      <td class="wide-input-col">${html(booking.regionalInputs?.retailInput || "")}</td>
      <td class="sticky-action"><button class="secondary" data-open-booking="${html(booking.id)}">Open</button></td>
    </tr>
  `;
}

function renderBookings() {
  return `
    ${renderTopbar(detailTitle(), "Imported Excel fields are readonly; workflow fields are role based.")}
    ${canAdmin() ? renderBookingUploadTab() : ""}
    ${renderBookingsPanel()}
  `;
}

function renderExcelContent() {
  return `
    ${renderTopbar("Excel Content", "Admin view of the imported booking file fields and saved workflow updates.")}
    ${renderExcelContentSection()}
  `;
}

function renderExcelContentSection() {
  const pageData = paginatedRows(state.bookings, "excelPage");
  return `
    <section class="panel">
      <h2>Excel Content</h2>
      <p>These columns follow the booking Excel sample. Imported fields are readonly; Area Manager and Regional Manager updates appear at the end.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${excelColumns.map(([, label]) => `<th>${html(label)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${
              pageData.rows
                .map((booking) => `<tr>${excelColumns.map(([key]) => `<td>${html(readPath(booking, key))}</td>`).join("")}</tr>`)
                .join("") || `<tr><td colspan="${excelColumns.length}">No imported rows available.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      ${renderPagination("excelPage", pageData)}
    </section>
  `;
}

function renderUploadPreview() {
  if (!state.uploadPreview) return "";
  return `
    <section class="panel">
      <h2>Booking Upload Preview</h2>
      <p>${html(state.uploadPreview.fileName)} - showing up to 10 rows before import. Review the content, then click Upload Booking File.</p>
      ${
        state.pendingBookingUpload
          ? `<div class="actions"><button id="confirmBookingUpload">Upload Booking File</button><button class="secondary" id="clearBookingPreview">Clear Preview</button></div>`
          : ""
      }
      <div class="table-wrap">
        <table>
          <thead><tr>${state.uploadPreview.headers.map((header) => `<th>${html(header)}</th>`).join("")}</tr></thead>
          <tbody>
            ${
              state.uploadPreview.rows
                .map((row) => `<tr>${state.uploadPreview.headers.map((_, index) => `<td>${html(row[index] || "")}</td>`).join("")}</tr>`)
                .join("") || `<tr><td colspan="${state.uploadPreview.headers.length || 1}">No preview rows.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderBookingUploadTab() {
  return `
    <section class="panel">
      <h2>Booking Upload</h2>
      <p>Upload CSV using the booking template. The backend validates required columns and upserts by Sales Order Id.</p>
      <div class="actions">
        <a href="/api/admin/bookings/template"><button class="secondary">Download Booking Template</button></a>
        <button id="sampleBookingUpload">Preview Sample Booking Upload</button>
      </div>
      <div class="field">
        <label>Select booking CSV</label>
        <input id="bookingFile" type="file" accept=".csv" />
      </div>
    </section>
    ${renderUploadPreview()}
    ${renderExcelContentSection()}
  `;
}

function renderUserUploadTab() {
  return `
    <section class="panel">
      <h2>User Upload</h2>
      <p>Create users one by one or upload a bulk user template. New users receive temporary credentials in the result.</p>
      <div class="actions">
        <a href="/api/admin/users/template"><button class="secondary">Download User Template</button></a>
        <button id="sampleUserUpload">Use Sample User Upload</button>
      </div>
      <div class="field">
        <label>Upload user CSV</label>
        <input id="userFile" type="file" accept=".csv" />
      </div>
    </section>
  `;
}

const userTableColumns = [
  ["name", "Name"],
  ["email", "Email"],
  ["role", "Role"],
  ["region", "Region"],
  ["reportingManagerEmail", "Reporting Manager"],
  ["status", "Status"]
];

function uniqueUserValues(key) {
  return [...new Set((state.bootstrap?.users || []).map((user) => user[key]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b))
  );
}

function filteredUsers() {
  const filters = state.userTable;
  const search = filters.search.trim().toLowerCase();
  const rows = (state.bootstrap?.users || []).filter((user) => {
    const matchesSearch =
      !search ||
      [user.name, user.email, user.phone, user.role, user.region, user.reportingManagerEmail, user.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    const matchesRole = !filters.role || user.role === filters.role;
    const matchesStatus = !filters.status || user.status === filters.status;
    const matchesRegion = !filters.region || user.region === filters.region;
    return matchesSearch && matchesRole && matchesStatus && matchesRegion;
  });

  return rows.sort((left, right) => {
    const leftValue = String(left[filters.sortKey] || "").toLowerCase();
    const rightValue = String(right[filters.sortKey] || "").toLowerCase();
    const result = leftValue.localeCompare(rightValue);
    return filters.sortDir === "asc" ? result : -result;
  });
}

function sortSymbol(key) {
  if (state.userTable.sortKey !== key) return "↕";
  return state.userTable.sortDir === "asc" ? "↑" : "↓";
}

function renderSortableUserHeader([key, label]) {
  return `
    <th>
      <button class="sort-header" data-user-sort="${html(key)}" aria-label="Sort users by ${html(label)}">
        <span>${html(label)}</span>
        <span class="sort-symbol">${sortSymbol(key)}</span>
      </button>
    </th>
  `;
}

function renderCurrentUsersTable() {
  const users = filteredUsers();
  return `
    <section class="panel">
      <div class="section-heading-row">
        <div>
          <h2>Current Users</h2>
          <p>${users.length} of ${(state.bootstrap?.users || []).length} users shown</p>
        </div>
      </div>
      <div class="toolbar user-filter-toolbar">
        <input id="userSearch" value="${html(state.userTable.search)}" placeholder="Search users" />
        <select id="userRoleFilter">
          <option value="">All roles</option>
          ${uniqueUserValues("role").map((role) => `<option value="${html(role)}" ${state.userTable.role === role ? "selected" : ""}>${html(role)}</option>`).join("")}
        </select>
        <select id="userRegionFilter">
          <option value="">All regions</option>
          ${uniqueUserValues("region").map((region) => `<option value="${html(region)}" ${state.userTable.region === region ? "selected" : ""}>${html(region)}</option>`).join("")}
        </select>
        <select id="userStatusFilter">
          <option value="">All status</option>
          ${uniqueUserValues("status").map((status) => `<option value="${html(status)}" ${state.userTable.status === status ? "selected" : ""}>${html(status)}</option>`).join("")}
        </select>
        <button class="secondary" id="clearUserFilters">Clear Filters</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>${userTableColumns.map(renderSortableUserHeader).join("")}</tr></thead>
          <tbody>
            ${
              users
                .map((user) => `<tr><td>${html(user.name)}</td><td>${html(user.email)}</td><td>${html(user.role)}</td><td>${html(user.region)}</td><td>${html(user.reportingManagerEmail)}</td><td>${html(user.status)}</td></tr>`)
                .join("") || `<tr><td colspan="${userTableColumns.length}">No users found.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderUsers() {
  return `
    ${renderTopbar("Users", "Create users one by one or upload a bulk user template.")}
    ${renderUserUploadTab()}
    <section class="panel">
      <h2>Add Single User</h2>
      <form id="singleUserForm" class="form-grid">
        <div class="field"><label>Name</label><input name="Name" required value="Demo Area Manager" /></div>
        <div class="field"><label>Email</label><input name="Email" type="email" required value="demo.am@example.com" /></div>
        <div class="field"><label>Phone</label><input name="Phone" value="9999990020" /></div>
        <div class="field"><label>Role</label><select name="Role">${state.bootstrap.roles.map((role) => `<option>${html(role)}</option>`).join("")}</select></div>
        <div class="field"><label>Region</label><input name="Region" value="West" /></div>
        <div class="field"><label>Dealer Code</label><input name="Dealer Code" value="abcd" /></div>
        <div class="field"><label>Reporting Manager Email</label><input name="Reporting Manager Email" value="rm.west@example.com" /></div>
        <div class="field"><label>Status</label><select name="Status"><option>active</option><option>inactive</option><option>locked</option></select></div>
        <div class="field"><label>Temporary Password</label><input name="Temporary Password" value="" placeholder="Auto generated if blank" /></div>
        <div class="actions"><button>Create / Update User</button></div>
      </form>
    </section>
    ${renderCurrentUsersTable()}
  `;
}

const lookupFieldLabels = {
  bookingCategory: "Booking Category",
  wholesalesFeedback: "Wholesales Feedback",
  wsPlanning: "WS Planning",
  cancellationReason: "Cancellation / Not-Decided Reason"
};

function renderAreaFields() {
  const lookupOptions = state.bootstrap.lookupOptions || {};
  const selectedField = state.selectedAreaField;
  const selectedOptions = lookupOptions[selectedField] || [];
  return `
    ${renderTopbar("Area Fields", "Admin-managed content used by Area Manager booking updates.")}
    <section class="panel">
      <h2>Area Manager Dropdown Values</h2>
      <p>Select a field, then add, edit, deactivate, or reactivate its dropdown options. Inactive options are hidden from new booking updates but remain available for historical records.</p>
      <div class="form-grid">
        <div class="field">
          <label>Select Field</label>
          <select id="areaFieldSelector">
            ${Object.entries(lookupFieldLabels)
              .map(([fieldCode, label]) => `<option value="${fieldCode}" ${fieldCode === selectedField ? "selected" : ""}>${html(label)}</option>`)
              .join("")}
          </select>
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="section-heading-row">
        <div>
          <h2>${html(lookupFieldLabels[selectedField])} Options</h2>
          <p>Manage the items that appear in this dropdown.</p>
        </div>
        <button id="openAddOptionModal">Add Option</button>
      </div>
      <div class="table-wrap compact-table">
        <table>
          <thead><tr><th>Option</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${
              selectedOptions
                .map(
                  (option) => `
                    <tr>
                      <td>
                        <input class="option-label-input" data-option-label="${html(option.id)}" value="${html(option.label)}" />
                      </td>
                      <td><span class="badge ${option.status === "active" ? "ok" : "warn"}">${html(option.status)}</span></td>
                      <td>
                        <div class="actions">
                          <button class="secondary" data-save-option="${html(option.id)}">Save</button>
                          ${
                            option.status === "active"
                              ? `<button class="secondary" data-status-option="${html(option.id)}" data-status="inactive">Deactivate</button>`
                              : `<button class="secondary" data-status-option="${html(option.id)}" data-status="active">Reactivate</button>`
                          }
                        </div>
                      </td>
                    </tr>
                  `
                )
                .join("") || `<tr><td colspan="3">No options configured.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAddOptionModal() {
  const fieldCode = state.selectedAreaField;
  return `
    <div class="modal-backdrop">
      <section class="modal small-modal">
        <div class="modal-header">
          <div>
            <h2>Add Option</h2>
            <p>Add a new value for the selected dropdown field.</p>
          </div>
          <button class="secondary" id="closeAddOptionModal">Close</button>
        </div>
        <form id="addLookupOptionModalForm" class="grid">
          <div class="field">
            <label>Selected Field</label>
            <input value="${html(lookupFieldLabels[fieldCode])}" readonly />
          </div>
          <div class="field">
            <label>Option Value</label>
            <input name="label" placeholder="Enter option value" autofocus />
          </div>
          <div class="actions">
            <button>Add Option</button>
            <button type="button" class="secondary" id="cancelAddOptionModal">Cancel</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderBookingModal(booking) {
  const lookups = state.bootstrap.lookups;
  const select = (name, values, current) => `
    <select name="${name}" ${canAreaEdit() ? "" : "disabled"}>
      <option value="">Select</option>
      ${values.map((value) => `<option ${value === current ? "selected" : ""}>${html(value)}</option>`).join("")}
    </select>
  `;
  const showAreaSection = ["Admin", "Area Manager", "Regional Manager", "All India", "All India I", "All India II"].includes(state.user.role);
  const showRegionalSection = ["Admin", "Regional Manager", "All India", "All India I", "All India II"].includes(state.user.role);
  const areaSection = `
    <section class="panel">
      <h2>Area Manager Inputs</h2>
      <form id="areaForm" class="area-input-grid">
        <div class="field"><label>Booking Category</label>${select("bookingCategory", lookups.bookingCategory, booking.areaInputs?.bookingCategory)}</div>
        <div class="field"><label>Wholesales Feedback</label>${select("wholesalesFeedback", lookups.wholesalesFeedback, booking.areaInputs?.wholesalesFeedback)}</div>
        <div class="field"><label>WS Planning</label>${select("wsPlanning", lookups.wsPlanning, booking.areaInputs?.wsPlanning)}</div>
        <div class="field"><label>Expected Retail Date</label><input name="expectedRetailDate" type="date" value="${html(booking.areaInputs?.expectedRetailDate || "")}" ${canAreaEdit() ? "" : "disabled"} /></div>
        <div class="field"><label>Remarks for Cancellation / Not Yet Decided</label>${select("cancellationReason", lookups.cancellationReason, booking.areaInputs?.cancellationReason)}</div>
        ${canAreaEdit() ? `<button>Save Area Inputs</button>` : ""}
      </form>
    </section>
  `;
  const regionalSection = `
    <section class="panel">
      <h2>Regional Manager Inputs</h2>
      <form id="regionalForm" class="grid">
        <div class="field"><label>Wholesale Input</label><textarea name="wholesaleInput" maxlength="2000" ${canRegionalEdit() ? "" : "disabled"}>${html(booking.regionalInputs?.wholesaleInput || "")}</textarea></div>
        <div class="field"><label>Retail Input</label><textarea name="retailInput" maxlength="2000" ${canRegionalEdit() ? "" : "disabled"}>${html(booking.regionalInputs?.retailInput || "")}</textarea></div>
        ${canRegionalEdit() ? `<button>Save Regional Inputs</button>` : ""}
      </form>
    </section>
  `;
  const readonlyFields = [
    ["Dealer Code", booking.dealerCode],
    ["Contact First Name", booking.contactFirstName],
    ["Contact Last Name", booking.contactLastName],
    ["Phone Number", booking.phoneNumber],
    ["Sales Order Id", booking.salesOrderId],
    ["Creation Date", booking.creationDate],
    ["Dlr GRP", booking.dealerGroup],
    ["AM", booking.amNameFromFile],
    ["Region", booking.region],
    ["Category", booking.category],
    ["MODEL", booking.model],
    ["VARIANT", booking.variant],
    ["Color mapped", booking.colorMapped],
    ["CAT", booking.cat],
    ["VINYEAR", booking.vinYear],
    ["MATCHED STATUS", booking.matchedStatus],
    ["AVL STATUS", booking.avlStatus],
    ["RPOS ORDER STATUS", booking.rposOrderStatus],
    ["RPASS BKG", booking.rpassBkg],
    ["COMB1", booking.comb1]
  ];
  return `
    <div class="modal-backdrop">
      <section class="modal">
        <div class="modal-header">
          <div>
            <h2>Booking Details</h2>
            <p>Review booking information and role-specific updates.</p>
          </div>
          <button class="modal-close-button" id="closeModal" aria-label="Close booking details" title="Close">×</button>
        </div>
        <section class="panel">
          <h2>Booking Fields</h2>
          <div class="readonly-grid">
            ${readonlyFields.map(([label, value]) => `<div class="readonly"><small>${html(label)}</small><strong>${html(value)}</strong></div>`).join("")}
          </div>
        </section>
        <div class="workflow-stack">
          ${showAreaSection ? areaSection : ""}
          ${showRegionalSection ? regionalSection : ""}
        </div>
      </section>
    </div>
  `;
}

async function uploadContent(endpoint, fileName, content) {
  try {
    const result = await api.post(endpoint, { fileName, content });
    await loadBootstrap();
    await loadBookings();
    setNotice(`${result.originalFileName}: ${result.status}. Inserted ${result.insertedRows}, updated ${result.updatedRows}, failed ${result.failedRows}.`);
  } catch (error) {
    const details = error.payload?.errors?.slice(0, 4).map((item) => `${item.columnName}: ${item.errorMessage}`).join("; ");
    setNotice(details || error.message, "error");
  }
}

async function handleFileUpload(input, endpoint) {
  const file = input.files?.[0];
  if (!file) return;
  const content = await file.text();
  if (endpoint.includes("/bookings/")) {
    state.uploadPreview = { fileName: file.name, ...parseCsvPreview(content) };
    state.pendingBookingUpload = { fileName: file.name, content };
    state.notice = { message: "Booking file preview is ready. Review it, then click Upload Booking File.", type: "success" };
    render();
    input.value = "";
    return;
  }
  await uploadContent(endpoint, file.name, content);
  input.value = "";
}

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function saveArea(event) {
  event.preventDefault();
  const payload = { ...formObject(event.target), updatedBy: state.user.id };
  await api.patch(`/api/bookings/${state.selectedBooking.id}/area-inputs`, payload);
  await loadBookings();
  state.selectedBooking = null;
  setNotice("Area Manager inputs saved.");
}

async function saveRegional(event) {
  event.preventDefault();
  const payload = { ...formObject(event.target), updatedBy: state.user.id };
  await api.patch(`/api/bookings/${state.selectedBooking.id}/regional-inputs`, payload);
  await loadBookings();
  state.selectedBooking = null;
  setNotice("Regional Manager inputs saved.");
}

function bindCommonEvents() {
  document.querySelector("#refreshBookings")?.addEventListener("click", async () => {
    await loadBookings();
    render();
  });
  document.querySelector("#clearDetailFilter")?.addEventListener("click", async () => {
    state.detailFilter = "all";
    state.bookingPage = 1;
    await loadBookings();
    render();
  });
  document.querySelector("#confirmBookingUpload")?.addEventListener("click", async () => {
    if (!state.pendingBookingUpload) return;
    const pending = state.pendingBookingUpload;
    state.pendingBookingUpload = null;
    await uploadContent("/api/admin/bookings/import", pending.fileName, pending.content);
  });
  document.querySelector("#clearBookingPreview")?.addEventListener("click", () => {
    state.uploadPreview = null;
    state.pendingBookingUpload = null;
    state.notice = null;
    render();
  });
  document.querySelectorAll("[data-metric-filter]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.detailFilter = button.dataset.metricFilter || "all";
      state.activeView = "bookings";
      state.bookingPage = 1;
      await loadBookings();
      render();
    });
  });
  document.querySelector("#search")?.addEventListener("input", async () => {
    state.bookingFilters.search = document.querySelector("#search")?.value || "";
    state.bookingPage = 1;
    state.excelPage = 1;
    await loadBookings();
    render();
  });
  document.querySelector("#regionFilter")?.addEventListener("change", async () => {
    state.bookingFilters.region = document.querySelector("#regionFilter")?.value || "";
    state.bookingPage = 1;
    state.excelPage = 1;
    await loadBookings();
    render();
  });
  document.querySelector("#wholesaleInputFilter")?.addEventListener("change", async () => {
    state.bookingFilters.wholesaleInput = document.querySelector("#wholesaleInputFilter")?.value || "";
    state.bookingPage = 1;
    state.excelPage = 1;
    await loadBookings();
    render();
  });
  document.querySelector("#retailInputFilter")?.addEventListener("change", async () => {
    state.bookingFilters.retailInput = document.querySelector("#retailInputFilter")?.value || "";
    state.bookingPage = 1;
    state.excelPage = 1;
    await loadBookings();
    render();
  });
  document.querySelectorAll("[data-page-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const pageKey = button.dataset.pageKey;
      const action = button.dataset.pageAction;
      const totalPages = Math.max(1, Math.ceil(state.bookings.length / state.pageSize));
      const pageNumber = Number(button.dataset.pageNumber);
      if (Number.isFinite(pageNumber) && pageNumber > 0) state[pageKey] = pageNumber;
      if (action === "first") state[pageKey] = 1;
      if (action === "prev") state[pageKey] = Math.max(1, state[pageKey] - 1);
      if (action === "next") state[pageKey] = Math.min(totalPages, state[pageKey] + 1);
      if (action === "last") state[pageKey] = totalPages;
      render();
    });
  });
  document.querySelector("#userSearch")?.addEventListener("input", (event) => {
    state.userTable.search = event.target.value;
    render();
  });
  document.querySelector("#userRoleFilter")?.addEventListener("change", (event) => {
    state.userTable.role = event.target.value;
    render();
  });
  document.querySelector("#userRegionFilter")?.addEventListener("change", (event) => {
    state.userTable.region = event.target.value;
    render();
  });
  document.querySelector("#userStatusFilter")?.addEventListener("change", (event) => {
    state.userTable.status = event.target.value;
    render();
  });
  document.querySelector("#clearUserFilters")?.addEventListener("click", () => {
    state.userTable.search = "";
    state.userTable.role = "";
    state.userTable.status = "";
    state.userTable.region = "";
    render();
  });
  document.querySelectorAll("[data-user-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.userSort;
      if (state.userTable.sortKey === key) {
        state.userTable.sortDir = state.userTable.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.userTable.sortKey = key;
        state.userTable.sortDir = "asc";
      }
      render();
    });
  });
  document.querySelectorAll("[data-open-booking]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedBooking = state.bookings.find((booking) => booking.id === button.dataset.openBooking);
      render();
    });
  });
  document.querySelector("#closeModal")?.addEventListener("click", () => {
    state.selectedBooking = null;
    render();
  });
  document.querySelector("#areaForm")?.addEventListener("submit", saveArea);
  document.querySelector("#regionalForm")?.addEventListener("submit", saveRegional);
  document.querySelector("#bookingFile")?.addEventListener("change", (event) => handleFileUpload(event.target, "/api/admin/bookings/import"));
  document.querySelector("#userFile")?.addEventListener("change", (event) => handleFileUpload(event.target, "/api/admin/users/import"));
  document.querySelector("#sampleBookingUpload")?.addEventListener("click", async () => {
    const content = await fetch("/api/admin/bookings/template").then((response) => response.text());
    state.uploadPreview = { fileName: "sample-booking-upload.csv", ...parseCsvPreview(content) };
    state.pendingBookingUpload = { fileName: "sample-booking-upload.csv", content };
    setNotice("Sample booking preview is ready. Review it, then click Upload Booking File.");
  });
  document.querySelector("#sampleUserUpload")?.addEventListener("click", async () => {
    const content = await fetch("/api/admin/users/template").then((response) => response.text());
    await uploadContent("/api/admin/users/import", "sample-user-upload.csv", content);
  });
  document.querySelector("#areaFieldSelector")?.addEventListener("change", (event) => {
    state.selectedAreaField = event.target.value;
    state.addOptionModalOpen = false;
    state.notice = null;
    render();
  });
  document.querySelector("#openAddOptionModal")?.addEventListener("click", () => {
    state.addOptionModalOpen = true;
    render();
  });
  document.querySelector("#closeAddOptionModal")?.addEventListener("click", () => {
    state.addOptionModalOpen = false;
    render();
  });
  document.querySelector("#cancelAddOptionModal")?.addEventListener("click", () => {
    state.addOptionModalOpen = false;
    render();
  });
  document.querySelector("#addLookupOptionModalForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const label = formObject(event.target).label;
    try {
      const result = await api.post(`/api/admin/lookups/${state.selectedAreaField}/options`, {
        label,
        updatedBy: state.user.id
      });
      state.bootstrap.lookups = result.lookups;
      state.bootstrap.lookupOptions = result.lookupOptions;
      state.addOptionModalOpen = false;
      setNotice(`${lookupFieldLabels[state.selectedAreaField]} option added.`);
    } catch (error) {
      setNotice(error.payload?.error || error.message, "error");
    }
  });
  document.querySelectorAll("[data-save-option]").forEach((button) => {
    button.addEventListener("click", async () => {
      const optionId = button.dataset.saveOption;
      const label = document.querySelector(`[data-option-label="${CSS.escape(optionId)}"]`)?.value || "";
      try {
        const result = await api.patch(`/api/admin/lookups/${state.selectedAreaField}/options/${encodeURIComponent(optionId)}`, {
          label,
          updatedBy: state.user.id
        });
        state.bootstrap.lookups = result.lookups;
        state.bootstrap.lookupOptions = result.lookupOptions;
        setNotice(`${lookupFieldLabels[state.selectedAreaField]} option saved.`);
      } catch (error) {
        setNotice(error.payload?.error || error.message, "error");
      }
    });
  });
  document.querySelectorAll("[data-status-option]").forEach((button) => {
    button.addEventListener("click", async () => {
      const optionId = button.dataset.statusOption;
      const status = button.dataset.status;
      const label = document.querySelector(`[data-option-label="${CSS.escape(optionId)}"]`)?.value || "";
      try {
        const result = await api.patch(`/api/admin/lookups/${state.selectedAreaField}/options/${encodeURIComponent(optionId)}`, {
          label,
          status,
          updatedBy: state.user.id
        });
        state.bootstrap.lookups = result.lookups;
        state.bootstrap.lookupOptions = result.lookupOptions;
        setNotice(`${lookupFieldLabels[state.selectedAreaField]} option ${status === "active" ? "reactivated" : "deactivated"}.`);
      } catch (error) {
        setNotice(error.payload?.error || error.message, "error");
      }
    });
  });
  document.querySelector("#singleUserForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api.post("/api/admin/users", formObject(event.target));
      await loadBootstrap();
      setNotice(`User saved. Inserted ${result.insertedRows}, updated ${result.updatedRows}.`);
    } catch (error) {
      const details = error.payload?.errors?.map((item) => `${item.columnName}: ${item.errorMessage}`).join("; ");
      setNotice(details || error.message, "error");
    }
  });
}

function render() {
  if (!state.user) return renderLogin();
  if (state.activeView === "bookings") return renderShell(renderBookings());
  if (state.activeView === "area-fields") return renderShell(renderAreaFields());
  if (state.activeView === "users") return renderShell(renderUsers());
  return renderShell(renderDashboard());
}

render();


