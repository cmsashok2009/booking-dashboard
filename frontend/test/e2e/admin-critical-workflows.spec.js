import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const user = { id: "admin-1", name: "Admin User", email: "admin@example.com", role: "Admin", region: "All" };
const adminUsers = Array.from({ length: 21 }, (_, index) => ({
  id: `paged-user-${index + 1}`,
  name: `Paged User ${String(index + 1).padStart(2, "0")}`,
  email: `paged.user.${index + 1}@example.com`,
  role: index === 0 ? "Admin" : index === 1 ? "Area Manager" : "Dealer",
  region: index % 2 ? "North" : "South",
  dealerCode: index === 1 ? "D001" : "",
  reportingManagerEmail: index === 1 ? "admin@example.com" : "",
  status: "active"
}));
const booking = {
  id: "b1",
  salesOrderId: "SO1001",
  dealerCode: "D001",
  contactFirstName: "Ravi",
  contactLastName: "Rao",
  phoneNumber: "9000000000",
  region: "North",
  amNameFromFile: "North AM",
  model: "Duster",
  variant: "Techno",
  matchedStatus: "MATCHED",
  agingBookings: "4",
  avlStatus: "Available",
  areaInputs: { bookingCategory: "Confirmed", wsPlanning: "Week 2" },
  regionalInputs: {}
};
const bootstrap = {
  currentUser: user,
  roles: ["Admin", "Area Manager", "Regional Manager", "Dealer"],
  regions: ["North", "South"],
  dealerCodes: [{ id: "dealer-1", code: "D001", label: "D001", region: "North", status: "active" }],
  roleDefinitions: [
    { name: "Area Manager", code: "AM", managerRoleCode: "RM", isActive: true },
    { name: "Regional Manager", code: "RM", managerRoleCode: null, isActive: true }
  ],
  lookupOptions: {
    bookingCategory: [{ id: "o1", label: "Confirmed", status: "active" }],
    wholesalesFeedback: [{ id: "o2", label: "To be wholesaled", status: "active" }],
    wsPlanning: [{ id: "o3", label: "Week 2", status: "active" }],
    cancellationReason: [{ id: "o4", label: "Customer request", status: "active" }]
  },
  users: [
    user,
    {
      id: "manager-1",
      name: "North Manager",
      email: "manager@example.com",
      role: "Area Manager",
      region: "North",
      status: "active"
    }
  ],
  onboardingWorkflows: [],
  emailTemplateSamples: [
    {
      id: "sample-1",
      name: "Activation starter",
      type: "activation",
      description: "Welcome message",
      subject: "Activate your account",
      reviewedAt: "2026-07-01T10:00:00Z",
      body: "Welcome {{name}}"
    }
  ],
  emailTemplates: [
    {
      id: "template-1",
      name: "Activation",
      type: "activation",
      subject: "Activate your account",
      body: "Welcome {{name}}",
      status: "active",
      version: 2,
      updatedAt: "2026-07-30T10:00:00Z"
    }
  ],
  emailCampaigns: [
    {
      id: "campaign-1",
      createdAt: "2026-07-31T10:00:00Z",
      status: "completed",
      total: 1,
      sent: 1,
      failed: 0,
      recipients: [
        {
          id: "recipient-1",
          name: "North Manager",
          email: "manager@example.com",
          status: "sent",
          provider: "Gmail",
          sentAt: "2026-07-31T10:01:00Z"
        }
      ]
    }
  ],
  emailProvider: {
    configured: true,
    connected: true,
    accountEmail: "sender@example.com",
    connectedAt: "2026-07-01T10:00:00Z",
    lastTestAt: "2026-07-30T10:00:00Z"
  }
};

function campaignPage(url, campaigns) {
  const search = (url.searchParams.get("search") || "").toLowerCase();
  const status = url.searchParams.get("status") || "all";
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("pageSize") || 5);
  const filtered = campaigns.filter((campaign) => {
    if (status === "successful" && campaign.failed) return false;
    if (status === "failed" && !campaign.failed) return false;
    return (
      !search ||
      campaign.recipients.some((recipient) =>
        [recipient.name, recipient.email].some((value) => value.toLowerCase().includes(search))
      )
    );
  });
  const start = (page - 1) * pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  return {
    campaigns: filtered.slice(start, start + pageSize),
    pagination: { page, pageSize, total: filtered.length, totalPages, hasNextPage: page < totalPages },
    summary: {
      campaigns: campaigns.length,
      sent: campaigns.reduce((total, campaign) => total + campaign.sent, 0),
      failed: campaigns.reduce((total, campaign) => total + campaign.failed, 0)
    },
    events: [],
    eventPagination: { limit: 100, total: 0, hasMore: false }
  };
}
function templatePage(url, templates, samples = bootstrap.emailTemplateSamples) {
  const search = (url.searchParams.get("search") || "").toLowerCase();
  const status = url.searchParams.get("status") || "";
  const type = url.searchParams.get("type") || "";
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("pageSize") || 10);
  const filtered = templates.filter(
    (template) =>
      (!search || [template.name, template.subject].some((value) => value.toLowerCase().includes(search))) &&
      (!status || template.status === status) &&
      (!type || template.type === type)
  );
  const start = (page - 1) * pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  return {
    samples: samples.slice(0, 100),
    samplePagination: { limit: 100, total: samples.length, hasMore: samples.length > 100 },
    templates: filtered.slice(start, start + pageSize),
    pagination: { page, pageSize, total: filtered.length, totalPages, hasNextPage: page < totalPages },
    summary: {
      total: templates.length,
      active: templates.filter((template) => template.status === "active").length,
      draft: templates.filter((template) => template.status === "draft").length
    }
  };
}
async function expectNoSeriousAxe(page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.pathname === "/api/admin/reference-data",
    (route) => {
      const url = new URL(route.request().url());
      const collection = url.searchParams.get("collection");
      const fieldCode = url.searchParams.get("fieldCode");
      let items = [];
      if (collection === "regions") {
        items = bootstrap.regions.map((name, index) => ({
          id: "region-" + index,
          name,
          label: name,
          status: "active"
        }));
      } else if (collection === "roles") {
        items = bootstrap.roles.map((name, index) => {
          const definition = bootstrap.roleDefinitions.find((item) => item.name === name);
          return {
            id: definition?.code || "role-" + index,
            code: definition?.code || "ROLE_" + index,
            name,
            label: name,
            managerRoleCode: definition?.managerRoleCode || null,
            isActive: definition?.isActive !== false,
            status: "active"
          };
        });
      } else if (collection === "lookupOptions") {
        items = bootstrap.lookupOptions[fieldCode] || [];
      } else if (collection === "dealerCodes") {
        items = bootstrap.dealerCodes || [];
      } else if (collection === "dealerAssignments") {
        items = bootstrap.dealerAssignments || [];
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          collection,
          fieldCode: fieldCode || undefined,
          items,
          pagination: {
            page: 1,
            pageSize: 100,
            total: items.length,
            totalPages: 1,
            hasNextPage: false
          }
        })
      });
    }
  );
  await page.route(
    (url) => url.pathname === "/api/admin/onboarding",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workflows: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1, hasNextPage: false }
        })
      })
  );
});

test("Admin reference data is bounded and responsive", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const referenceRequests = [];
  const userMutations = [];
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/admin/reference-data") referenceRequests.push(url);
  });
  await page.addInitScript((sessionUser) => {
    window.sessionStorage.setItem("booking-dashboard-user", JSON.stringify(sessionUser));
  }, user);
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bootstrap) })
  );
  await page.route(
    (url) => url.pathname === "/api/bookings",
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rows: [] }) })
  );
  await page.route(
    (url) => url.pathname === "/api/notifications",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ notifications: [], unreadCount: 0 })
      })
  );
  await page.route("**/api/notifications/stream", (route) =>
    route.fulfill({ status: 200, contentType: "text/event-stream", body: ": connected\n\n" })
  );

  const mutations = [];
  await page.route(
    (url) => /^\/api\/admin\/(regions|dealer-codes)\/[^/]+$/.test(url.pathname),
    async (route) => {
      const request = route.request();
      const payload = request.postDataJSON();
      mutations.push({ path: new URL(request.url()).pathname, payload });
      const isRegion = new URL(request.url()).pathname.includes("/regions/");
      if (isRegion && payload.status === "inactive") {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            code: "REGION_IN_USE",
            error: "Deactivate or move the active Dealer Codes assigned to this Region first."
          })
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          isRegion
            ? { region: { id: "region-0", name: payload.name || "North", status: payload.status || "active" } }
            : {
                dealerCode: {
                  id: "dealer-1",
                  code: payload.code || "D001",
                  region: "North",
                  status: payload.status || "active"
                }
              }
        )
      });
    }
  );
  await page.route(
    (url) => url.pathname === "/api/ui/users/update",
    async (route) => {
      const payload = route.request().postDataJSON();
      userMutations.push(payload);
      const current = adminUsers.find((item) => item.id === payload.userId);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: { ...current, ...payload } })
      });
    }
  );
  await page.route(
    (url) => url.pathname === "/api/admin/users",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: adminUsers.slice(0, 10),
          pagination: { page: 1, pageSize: 10, total: adminUsers.length, totalPages: 3, hasNextPage: true }
        })
      })
  );

  await page.goto("/");
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open main navigation" }).click();
  }
  await page.getByRole("button", { name: "Business Settings" }).click();
  await expect(page.getByRole("heading", { name: "Business Settings", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Roles", level: 2 })).toBeVisible();
  await expect(page.getByText("Area Manager", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Regions" }).click();
  await page.getByRole("button", { name: "Edit" }).first().click();
  const regionInput = page.getByRole("textbox", { name: "Edit North" });
  await regionInput.fill("North East");
  await page.getByRole("button", { name: "Save" }).click();
  await expect
    .poll(() => mutations)
    .toContainEqual({
      path: "/api/admin/regions/region-0",
      payload: { name: "North East" }
    });
  await page.getByRole("button", { name: "Deactivate" }).first().click();
  const dependencyDialog = page.getByRole("alertdialog", { name: "Region cannot be deactivated" });
  await expect(dependencyDialog).toBeVisible();
  const modalVisualAudit = await dependencyDialog.evaluate((dialog) => {
    const dialogBox = dialog.getBoundingClientRect();
    const icon = dialog.querySelector(".blocking-dependency-icon");
    const detail = dialog.querySelector(".blocking-dependency-detail");
    const content = dialog.querySelector(".blocking-dependency-content");
    const footer = dialog.querySelector(".blocking-dependency-footer");
    const detailBox = detail.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    const footerBox = footer.getBoundingClientRect();
    return {
      width: dialogBox.width,
      top: dialogBox.top,
      right: dialogBox.right,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
      iconBackground: getComputedStyle(icon).backgroundColor,
      detailDisplay: getComputedStyle(detail).display,
      detailWidth: detailBox.width,
      contentWidth: contentBox.width,
      footerBelowContent: footerBox.top >= contentBox.bottom - 1
    };
  });
  expect(modalVisualAudit.width).toBeLessThanOrEqual(522);
  expect(modalVisualAudit.right).toBeLessThanOrEqual(modalVisualAudit.viewportWidth);
  expect(modalVisualAudit.top).toBeLessThan(modalVisualAudit.viewportHeight / 2);
  if (testInfo.project.name === "chromium") {
    expect(modalVisualAudit.width).toBeLessThanOrEqual(modalVisualAudit.viewportWidth / 2);
  }
  expect(modalVisualAudit.iconBackground).toBe("rgb(255, 242, 220)");
  expect(modalVisualAudit.detailDisplay).toBe("block");
  expect(modalVisualAudit.detailWidth).toBeLessThanOrEqual(modalVisualAudit.contentWidth);
  expect(modalVisualAudit.footerBelowContent).toBe(true);
  await expect(dependencyDialog).toContainText("This Region still has active Dealer Codes.");
  await expect(dependencyDialog.locator(".blocking-dependency-detail dd")).toHaveText(/North|South/);
  await expect(page.getByText("Deactivate or move the active Dealer Codes assigned to this Region first.")).toHaveCount(
    0
  );
  await expectNoSeriousAxe(page);
  await page.screenshot({
    path: `docs/evidence/screenshots/region-dependency-modal-${testInfo.project.name}.png`,
    fullPage: true
  });
  await dependencyDialog.getByRole("button", { name: "View Dealer Codes" }).click();
  await expect(page.getByRole("tab", { name: "Dealer Codes" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Deactivate" }).click();
  await expect
    .poll(() => mutations)
    .toContainEqual({
      path: "/api/admin/dealer-codes/dealer-1",
      payload: { code: "D001", status: "inactive" }
    });
  expect(mutations.every(({ path }) => !path.includes("/lookups/"))).toBe(true);

  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open main navigation" }).click();
  }
  await page.getByRole("button", { name: "User Management" }).click();
  const userRow = page.getByRole("row").filter({ hasText: "Paged User 02" });
  await userRow.getByRole("button", { name: "Edit" }).click();
  const editingRow = page.locator("tr.editing-row");
  await page.getByLabel("Region for Paged User 02").selectOption("South");
  await expect(page.getByLabel("Dealer Code for Paged User 02")).toHaveValue("");
  await expect(editingRow.getByText("Changing Region clears an incompatible Dealer Code.")).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.screenshot({
    path: `docs/evidence/screenshots/user-region-update-${testInfo.project.name}.png`,
    fullPage: true
  });
  await editingRow.getByRole("button", { name: "Save" }).click();
  await expect
    .poll(() => userMutations)
    .toContainEqual(expect.objectContaining({ userId: "paged-user-2", region: "South", dealerCode: "" }));
  await expect(editingRow).toHaveCount(0);

  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open main navigation" }).click();
  }
  await page.getByRole("button", { name: "Business Settings" }).click();
  await page.getByRole("tab", { name: "Booking Workflow" }).click();
  await expect(page.getByRole("heading", { name: "Booking Category", level: 2 })).toBeVisible();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await expectNoSeriousAxe(page);

  await expect.poll(() => new Set(referenceRequests.map((url) => url.searchParams.get("collection"))).size).toBe(5);
  expect(referenceRequests.every((url) => url.searchParams.get("pageSize") === "100")).toBe(true);
  expect(referenceRequests.every((url) => !url.searchParams.has("userId") && !url.searchParams.has("actorId"))).toBe(
    true
  );
  expect(runtimeErrors.filter((message) => !message.includes("409 (Conflict)"))).toEqual([]);
  expect(runtimeErrors.filter((message) => message.includes("409 (Conflict)"))).toHaveLength(1);
  await page.screenshot({
    path: `docs/evidence/screenshots/admin-reference-mutations-${testInfo.project.name}.png`,
    fullPage: true
  });
});
test("Admin critical views and primary actions are accessible", async ({ page }, testInfo) => {
  test.setTimeout(120000);
  test.skip(testInfo.project.name !== "chromium", "Full authenticated workflow runs once in Chromium.");

  await page.addInitScript((sessionUser) => {
    window.sessionStorage.setItem("booking-dashboard-user", JSON.stringify(sessionUser));
  }, user);
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bootstrap) })
  );
  await page.route(
    (url) => url.pathname === "/api/notifications",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ notifications: [], unreadCount: 0 })
      })
  );
  await page.route("**/api/notifications/stream", (route) =>
    route.fulfill({ status: 200, contentType: "text/event-stream", body: ": connected\n\n" })
  );
  const mutations = [];
  await page.route(
    (url) => /^\/api\/admin\/(regions|dealer-codes)\/[^/]+$/.test(url.pathname),
    async (route) => {
      const request = route.request();
      const payload = request.postDataJSON();
      mutations.push({ path: new URL(request.url()).pathname, payload });
      const isRegion = new URL(request.url()).pathname.includes("/regions/");
      if (isRegion && payload.status === "inactive") {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            code: "REGION_IN_USE",
            error: "Deactivate or move the active Dealer Codes assigned to this Region first."
          })
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          isRegion
            ? { region: { id: "region-0", name: payload.name || "North", status: payload.status || "active" } }
            : {
                dealerCode: {
                  id: "dealer-1",
                  code: payload.code || "D001",
                  region: "North",
                  status: payload.status || "active"
                }
              }
        )
      });
    }
  );
  await page.route(
    (url) => url.pathname === "/api/admin/users",
    (route) => {
      const url = new URL(route.request().url());
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const pageNumber = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 10);
      const filtered = adminUsers.filter((item) => !search || item.name.toLowerCase().includes(search));
      const start = (pageNumber - 1) * pageSize;
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: filtered.slice(start, start + pageSize),
          pagination: {
            page: pageNumber,
            pageSize,
            total: filtered.length,
            totalPages,
            hasNextPage: pageNumber < totalPages
          }
        })
      });
    }
  );
  await page.route(
    (url) => url.pathname === "/api/bookings",
    (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rows: [booking] }) })
  );

  await page.route(
    (url) => url.pathname === "/api/admin/regions" && url.search === "",
    (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          region: { id: "region-central", name: "Central", status: "active" },
          collectionUrl: "/api/admin/reference-data?collection=regions"
        })
      })
  );
  await page.route(
    (url) => url.pathname === "/api/admin/dealer-codes" && url.search === "",
    (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          dealerCode: { id: "dealer-central-001", code: "C-001", region: "Central", status: "active" },
          collectionUrl: "/api/admin/reference-data?collection=dealerCodes"
        })
      })
  );

  await page.route(
    (url) => url.pathname === "/api/admin/email-campaigns",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(campaignPage(new URL(route.request().url()), bootstrap.emailCampaigns))
      })
  );
  await page.route(
    (url) => url.pathname === "/api/admin/email-templates",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(templatePage(new URL(route.request().url()), bootstrap.emailTemplates))
      })
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await expectNoSeriousAxe(page);

  await page.getByRole("button", { name: "Booking Management" }).click();
  await expect(page.getByRole("heading", { name: "All Bookings", level: 1 })).toBeVisible();
  await page.getByLabel("Search bookings").fill("Ravi");
  await expect(page.getByText("SO1001")).toBeVisible();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Booking Details" })).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.getByRole("button", { name: "Close booking details" }).click();
  await page.getByRole("button", { name: "Upload bookings" }).click();
  await expect(page.getByRole("dialog", { name: "Upload bookings" })).toBeVisible();
  await page.getByRole("button", { name: "Close booking upload" }).click();

  await page.getByRole("button", { name: "Business Settings" }).click();
  await expect(page.getByRole("heading", { name: "Business Settings", level: 1 })).toBeVisible();
  await page.getByRole("tab", { name: "Booking Workflow" }).click();
  await expect(page.getByRole("heading", { name: "Booking Category", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Add option" }).click();
  await expect(page.getByRole("dialog", { name: "Add Booking Category" })).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.getByRole("button", { name: "Close add value" }).click();

  await page.getByRole("button", { name: "User Management" }).click();
  await expect(page.getByRole("heading", { name: "User Management", level: 1 })).toBeVisible();
  await expect(page.getByText("Paged User 01")).toBeVisible();
  await expect(page.getByText("1-10 of 21")).toBeVisible();
  await page.getByTitle("Next page").click();
  await expect(page.getByText("Paged User 11")).toBeVisible();
  await expect(page.getByText("11-20 of 21")).toBeVisible();
  await page.getByLabel("Search users").fill("Paged User 21");
  await expect(page.getByText("Paged User 21")).toBeVisible();
  await expect(page.getByText("1-1 of 1")).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.getByRole("tab", { name: "Add Users" }).click();
  await expect(page.getByRole("heading", { name: "Add Users", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Add Single User" }).click();
  const singleUserDialog = page.getByRole("dialog", { name: "Add Single User" });
  await expect(singleUserDialog).toBeVisible();
  const [phoneBox, roleBox] = await Promise.all([
    singleUserDialog.getByRole("textbox", { name: "Phone" }).boundingBox(),
    singleUserDialog.getByRole("combobox", { name: "Role" }).boundingBox()
  ]);
  expect(phoneBox).not.toBeNull();
  expect(roleBox).not.toBeNull();
  expect(Math.abs(phoneBox.y - roleBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(phoneBox.height - roleBox.height)).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: "docs/evidence/screenshots/single-user-form-alignment-chromium.png",
    fullPage: true
  });
  await singleUserDialog.getByRole("combobox", { name: "Role" }).selectOption({ label: "Area Manager" });
  await expect(singleUserDialog.getByText("Enter an active reporting manager account email.")).toBeVisible();
  const phone = singleUserDialog.getByRole("textbox", { name: "Phone" });
  await phone.fill("98ab76543210");
  await expect(phone).toHaveValue("9876543210");

  await singleUserDialog.getByRole("button", { name: "Add Region" }).click();
  const regionDialog = page.getByRole("dialog", { name: "Add Region" });
  await regionDialog.getByRole("textbox", { name: "Region name" }).fill("Central");
  await regionDialog.getByRole("button", { name: "Add and select Region" }).click();
  const returnedUserDialog = page.getByRole("dialog", { name: "Add Single User" });
  await expect(returnedUserDialog).toBeVisible();
  await expect(returnedUserDialog.getByRole("combobox", { name: "Region" })).toHaveValue("Central");

  await returnedUserDialog.getByRole("button", { name: "Add Dealer Code" }).click();
  const dealerDialog = page.getByRole("dialog", { name: "Add Dealer Code" });
  await dealerDialog.getByRole("textbox", { name: "Dealer Code" }).fill("C-001");
  await dealerDialog.getByRole("combobox", { name: "Region" }).selectOption("Central");
  await dealerDialog.getByRole("button", { name: "Add and select Dealer Code" }).click();
  const completedUserDialog = page.getByRole("dialog", { name: "Add Single User" });
  await expect(completedUserDialog).toBeVisible();
  await expect(completedUserDialog.getByRole("combobox", { name: "Dealer Code" })).toHaveValue("C-001");
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0);
  await page.screenshot({
    path: "docs/evidence/screenshots/area-manager-generic-reporting-manager-chromium.png",
    fullPage: true
  });
  await expectNoSeriousAxe(page);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Bulk Upload" }).click();
  await expect(page.getByRole("dialog", { name: "Bulk user onboarding" })).toBeVisible();
  await page.getByRole("button", { name: "Close user onboarding" }).click();

  await page.getByRole("button", { name: "Email Management" }).click();
  await expect(page.getByRole("heading", { name: "Email Management", level: 1 })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Email Configuration" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("sender@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByText("Stop Gmail delivery and remove the stored authorization?", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep connected" }).click();
  await expectNoSeriousAxe(page);

  await page.getByRole("tab", { name: "Email Operations" }).click();
  await page.getByRole("tab", { name: "Message Templates" }).click();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "Delivery Logs" }).click();
  await page.getByText("Activation campaign").click();
  await expect(page.getByRole("cell", { name: "manager@example.com" })).toBeVisible();
  await expectNoSeriousAxe(page);
});

test("Admin user server pagination is responsive and recoverable", async ({ page }, testInfo) => {
  await page.addInitScript((sessionUser) => {
    window.sessionStorage.setItem("booking-dashboard-user", JSON.stringify(sessionUser));
  }, user);
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bootstrap) })
  );
  await page.route(
    (url) => url.pathname === "/api/bookings",
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rows: [] }) })
  );
  await page.route(
    (url) => url.pathname === "/api/notifications",
    (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ notifications: [] }) })
  );
  await page.route("**/api/notifications/stream", (route) =>
    route.fulfill({ status: 200, contentType: "text/event-stream", body: ": connected\n\n" })
  );
  const mutations = [];
  await page.route(
    (url) => /^\/api\/admin\/(regions|dealer-codes)\/[^/]+$/.test(url.pathname),
    async (route) => {
      const request = route.request();
      const payload = request.postDataJSON();
      mutations.push({ path: new URL(request.url()).pathname, payload });
      const isRegion = new URL(request.url()).pathname.includes("/regions/");
      if (isRegion && payload.status === "inactive") {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            code: "REGION_IN_USE",
            error: "Deactivate or move the active Dealer Codes assigned to this Region first."
          })
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          isRegion
            ? { region: { id: "region-0", name: payload.name || "North", status: payload.status || "active" } }
            : {
                dealerCode: {
                  id: "dealer-1",
                  code: payload.code || "D001",
                  region: "North",
                  status: payload.status || "active"
                }
              }
        )
      });
    }
  );
  await page.route(
    (url) => url.pathname === "/api/admin/users",
    (route) => {
      const url = new URL(route.request().url());
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const pageNumber = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 10);
      const filtered = adminUsers.filter((item) => !search || item.name.toLowerCase().includes(search));
      const start = (pageNumber - 1) * pageSize;
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: filtered.slice(start, start + pageSize),
          pagination: {
            page: pageNumber,
            pageSize,
            total: filtered.length,
            totalPages,
            hasNextPage: pageNumber < totalPages
          }
        })
      });
    }
  );

  const workflows = Array.from({ length: 25 }, (_, index) => ({
    id: "workflow-" + (index + 1),
    fileName: "onboarding-batch-" + (index + 1) + ".csv",
    ownerUserId: user.id,
    status: "validation_review",
    currentStep: "validation",
    summary: { total: 10, ready: 10 },
    createdAt: "2026-08-01T00:" + String(index).padStart(2, "0") + ":00Z",
    updatedAt: "2026-08-02T00:" + String(index).padStart(2, "0") + ":00Z"
  }));
  let workflowAttempts = 0;
  await page.route(
    (url) => url.pathname === "/api/admin/onboarding",
    (route) => {
      workflowAttempts += 1;
      if (workflowAttempts === 1) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Workflow service unavailable" })
        });
      }
      const url = new URL(route.request().url());
      const pageNumber = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 20);
      const start = (pageNumber - 1) * pageSize;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workflows: workflows.slice(start, start + pageSize),
          pagination: {
            page: pageNumber,
            pageSize,
            total: workflows.length,
            totalPages: Math.ceil(workflows.length / pageSize),
            hasNextPage: start + pageSize < workflows.length
          }
        })
      });
    }
  );

  await page.goto("/");
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open main navigation" }).click();
    await page
      .getByRole("dialog", { name: "Main navigation" })
      .getByRole("button", { name: "User Management" })
      .click();
  } else {
    await page.getByRole("button", { name: "User Management" }).click();
  }
  await expect(page.getByText("1-10 of 21")).toBeVisible();
  await page.getByTitle("Next page").click();
  await expect(page.getByText("Paged User 11")).toBeVisible();
  await page.getByLabel("Search users").fill("Paged User 21");
  await expect(page.getByText("1-1 of 1")).toBeVisible();
  await page.getByRole("tab", { name: "Add Users" }).click();
  await expect(page.getByText("Workflow service unavailable")).toBeVisible();
  await page.getByRole("button", { name: "Retry onboarding" }).click();
  await expect(page.getByText("20 of 25 saved workflows loaded.")).toBeVisible();
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByText("25 of 25 saved workflows loaded.")).toBeVisible();
  const geometry = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth
  }));
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  await expectNoSeriousAxe(page);
  await page.screenshot({
    path: `docs/evidence/screenshots/admin-users-pagination-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled"
  });
});
test("Admin delivery campaign pagination is responsive and recoverable", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const campaigns = Array.from({ length: 7 }, (_, index) => ({
    id: `delivery-${index + 1}`,
    createdAt: `2026-08-0${index + 1}T10:00:00Z`,
    status: index === 5 ? "partially_completed" : "completed",
    total: 1,
    sent: index === 5 ? 0 : 1,
    failed: index === 5 ? 1 : 0,
    recipients: [
      {
        id: `recipient-${index + 1}`,
        name: `Recipient ${index + 1}`,
        email: `recipient.${index + 1}@example.com`,
        status: index === 5 ? "failed" : "sent",
        provider: "Gmail",
        failureReason: index === 5 ? "Provider rejected request" : "",
        sentAt: index === 5 ? null : `2026-08-0${index + 1}T10:01:00Z`
      }
    ]
  })).reverse();
  await page.addInitScript((sessionUser) => {
    window.sessionStorage.setItem("booking-dashboard-user", JSON.stringify(sessionUser));
  }, user);
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bootstrap) })
  );
  await page.route(
    (url) => url.pathname === "/api/bookings",
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rows: [] }) })
  );
  const mutations = [];
  await page.route(
    (url) => /^\/api\/admin\/(regions|dealer-codes)\/[^/]+$/.test(url.pathname),
    async (route) => {
      const request = route.request();
      const payload = request.postDataJSON();
      mutations.push({ path: new URL(request.url()).pathname, payload });
      const isRegion = new URL(request.url()).pathname.includes("/regions/");
      if (isRegion && payload.status === "inactive") {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            code: "REGION_IN_USE",
            error: "Deactivate or move the active Dealer Codes assigned to this Region first."
          })
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          isRegion
            ? { region: { id: "region-0", name: payload.name || "North", status: payload.status || "active" } }
            : {
                dealerCode: {
                  id: "dealer-1",
                  code: payload.code || "D001",
                  region: "North",
                  status: payload.status || "active"
                }
              }
        )
      });
    }
  );
  await page.route(
    (url) => url.pathname === "/api/admin/users",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: [user],
          pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNextPage: false }
        })
      })
  );
  await page.route(
    (url) => url.pathname === "/api/notifications",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ notifications: [], unreadCount: 0 })
      })
  );
  await page.route("**/api/notifications/stream", (route) =>
    route.fulfill({ status: 200, contentType: "text/event-stream", body: ": connected\n\n" })
  );
  await page.route(
    (url) => url.pathname === "/api/admin/email-templates",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(templatePage(new URL(route.request().url()), bootstrap.emailTemplates))
      })
  );
  let campaignRequests = 0;
  await page.route(
    (url) => url.pathname === "/api/admin/email-campaigns",
    (route) => {
      campaignRequests += 1;
      if (campaignRequests === 1) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Provider history unavailable" })
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(campaignPage(new URL(route.request().url()), campaigns))
      });
    }
  );

  await page.goto("/");
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open main navigation" }).click();
  }
  await page.getByRole("button", { name: "Email Management" }).click();
  await page.getByRole("tab", { name: "Email Operations" }).click();
  await page.getByRole("tab", { name: "Delivery Logs" }).click();
  await expect(page.getByRole("heading", { name: "Delivery campaigns unavailable" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("1-5 of 7")).toBeVisible();
  await expect(page.getByLabel("Delivery summary")).toContainText("Campaigns7");
  await page.getByTitle("Next page").click();
  await expect(page.getByText("6-7 of 7")).toBeVisible();
  await page.getByPlaceholder("Search recipient or email").fill("Recipient 7");
  await expect(page.getByText("1 campaign")).toBeVisible();
  await page.getByText("Activation campaign").click();
  await expect(page.getByText("recipient.7@example.com")).toBeVisible();
  await expectNoSeriousAxe(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(overflow).toBe(false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/evidence/screenshots/admin-delivery-pagination-${testInfo.project.name}.png`,
    fullPage: true
  });
});
test("Admin template pagination is responsive and recoverable", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const templates = Array.from({ length: 12 }, (_, index) => ({
    id: `template-${index + 1}`,
    name: `Organization Template ${String(index + 1).padStart(2, "0")}`,
    type: "user_activation",
    subject: `Activation subject ${index + 1}`,
    bodyText: "Hello {{user_name}} {{activation_link}} {{activation_expiry}} {{support_email}}",
    bodyHtml: "",
    status: index % 3 === 0 ? "draft" : "active",
    version: index + 1,
    updatedAt: `2026-08-${String(index + 1).padStart(2, "0")}T10:00:00Z`
  })).reverse();
  await page.addInitScript((sessionUser) => {
    window.sessionStorage.setItem("booking-dashboard-user", JSON.stringify(sessionUser));
  }, user);
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bootstrap) })
  );
  await page.route(
    (url) => url.pathname === "/api/bookings",
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rows: [] }) })
  );
  const mutations = [];
  await page.route(
    (url) => /^\/api\/admin\/(regions|dealer-codes)\/[^/]+$/.test(url.pathname),
    async (route) => {
      const request = route.request();
      const payload = request.postDataJSON();
      mutations.push({ path: new URL(request.url()).pathname, payload });
      const isRegion = new URL(request.url()).pathname.includes("/regions/");
      if (isRegion && payload.status === "inactive") {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            code: "REGION_IN_USE",
            error: "Deactivate or move the active Dealer Codes assigned to this Region first."
          })
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          isRegion
            ? { region: { id: "region-0", name: payload.name || "North", status: payload.status || "active" } }
            : {
                dealerCode: {
                  id: "dealer-1",
                  code: payload.code || "D001",
                  region: "North",
                  status: payload.status || "active"
                }
              }
        )
      });
    }
  );
  await page.route(
    (url) => url.pathname === "/api/admin/users",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: [user],
          pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNextPage: false }
        })
      })
  );
  await page.route(
    (url) => url.pathname === "/api/notifications",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ notifications: [], unreadCount: 0 })
      })
  );
  await page.route("**/api/notifications/stream", (route) =>
    route.fulfill({ status: 200, contentType: "text/event-stream", body: ": connected\n\n" })
  );
  let managementFailed = false;
  await page.route(
    (url) => url.pathname === "/api/admin/email-templates",
    (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("pageSize") === "10" && !managementFailed) {
        managementFailed = true;
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Template store unavailable" })
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(templatePage(url, templates))
      });
    }
  );

  await page.goto("/");
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open main navigation" }).click();
  }
  await page.getByRole("button", { name: "Email Management" }).click();
  await page.getByRole("tab", { name: "Email Operations" }).click();
  await page.getByRole("tab", { name: "Message Templates" }).click();
  await expect(page.getByRole("heading", { name: "Organization templates unavailable" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("1-10 of 12")).toBeVisible();
  await expect(page.getByText("8 active templates are available for user onboarding.")).toBeVisible();
  await page.getByTitle("Next page").click();
  await expect(page.getByText("11-12 of 12")).toBeVisible();
  await page.getByPlaceholder("Search name or subject").fill("Template 12");
  await expect(page.getByText("1 template")).toBeVisible();
  await expect(page.getByText("Organization Template 12")).toBeVisible();
  await page.getByRole("combobox", { name: "Status" }).selectOption("active");
  await expect(page.getByText("Organization Template 12")).toBeVisible();
  await expectNoSeriousAxe(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(overflow).toBe(false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/evidence/screenshots/admin-template-pagination-${testInfo.project.name}.png`,
    fullPage: true
  });
});

test("Notification history is bounded, recoverable, and responsive", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const notifications = Array.from({ length: 25 }, (_, index) => ({
    id: `notification-${index + 1}`,
    eventType: index % 2 ? "area_inputs_updated" : "regional_inputs_updated",
    bookingId: `booking-${index + 1}`,
    salesOrderId: `SO-${String(index + 1).padStart(3, "0")}`,
    dealerCode: "D001",
    actorName: index % 2 ? "Area Manager" : "Regional Manager",
    actorRole: index % 2 ? "Area Manager" : "Regional Manager",
    title: `Booking update ${index + 1}`,
    message: `Booking ${index + 1} changed.`,
    changedFields: [{ key: "status", label: "Status" }],
    createdAt: `2026-08-${String((index % 25) + 1).padStart(2, "0")}T10:00:00.000Z`
  })).reverse();

  await page.addInitScript((sessionUser) => {
    window.sessionStorage.setItem("booking-dashboard-user", JSON.stringify(sessionUser));
  }, user);
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bootstrap) })
  );
  await page.route(
    (url) => url.pathname === "/api/bookings",
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rows: [] }) })
  );
  const mutations = [];
  await page.route(
    (url) => /^\/api\/admin\/(regions|dealer-codes)\/[^/]+$/.test(url.pathname),
    async (route) => {
      const request = route.request();
      const payload = request.postDataJSON();
      mutations.push({ path: new URL(request.url()).pathname, payload });
      const isRegion = new URL(request.url()).pathname.includes("/regions/");
      if (isRegion && payload.status === "inactive") {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            code: "REGION_IN_USE",
            error: "Deactivate or move the active Dealer Codes assigned to this Region first."
          })
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          isRegion
            ? { region: { id: "region-0", name: payload.name || "North", status: payload.status || "active" } }
            : {
                dealerCode: {
                  id: "dealer-1",
                  code: payload.code || "D001",
                  region: "North",
                  status: payload.status || "active"
                }
              }
        )
      });
    }
  );
  await page.route(
    (url) => url.pathname === "/api/admin/users",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: [user],
          pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNextPage: false }
        })
      })
  );
  await page.route(
    (url) => url.pathname === "/api/admin/email-campaigns",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(campaignPage(new URL(route.request().url()), []))
      })
  );
  await page.route(
    (url) => url.pathname === "/api/admin/email-templates",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(templatePage(new URL(route.request().url()), []))
      })
  );

  let failedOnce = false;
  await page.route(
    (url) => url.pathname === "/api/notifications",
    (route) => {
      if (!failedOnce) {
        failedOnce = true;
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Notification service unavailable" })
        });
      }
      const url = new URL(route.request().url());
      const pageNumber = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 20);
      const start = (pageNumber - 1) * pageSize;
      const totalPages = Math.ceil(notifications.length / pageSize);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          notifications: notifications.slice(start, start + pageSize),
          unreadCount: notifications.length,
          pagination: {
            page: pageNumber,
            pageSize,
            total: notifications.length,
            totalPages,
            hasNextPage: pageNumber < totalPages
          }
        })
      });
    }
  );
  await page.route("**/api/notifications/stream", (route) =>
    route.fulfill({ status: 200, contentType: "text/event-stream", body: ": connected\n\n" })
  );

  await page.goto("/");
  await page.getByTitle("Notifications").click();
  await expect(page.getByRole("heading", { name: "Notifications unavailable" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("25 unread updates")).toBeVisible();
  await expect(page.getByText("Showing 20 of 25")).toBeVisible();
  await expect(page.getByRole("button", { name: "Notifications, 25 unread" })).toBeVisible();
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByText("Showing 25 of 25")).toBeVisible();
  await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
  await expectNoSeriousAxe(page);
  const firstNotification = page.getByRole("button", { name: /Unread notification:/ }).first();
  await firstNotification.hover();
  const hoverStyle = await firstNotification.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, color: style.color };
  });
  expect(hoverStyle.backgroundColor).toBe("rgb(243, 246, 250)");
  expect(hoverStyle.color).not.toBe("rgb(255, 255, 255)");
  const overflowAudit = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("body *")]
      .map((element) => ({
        tag: element.tagName,
        className: element.className?.toString?.() || "",
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth
      }))
      .filter((item) => item.right > document.documentElement.clientWidth + 1 || item.left < -1)
      .slice(0, 10)
  }));
  expect(overflowAudit.scrollWidth, JSON.stringify(overflowAudit)).toBeLessThanOrEqual(overflowAudit.clientWidth + 1);
  await page.screenshot({
    path: `docs/evidence/screenshots/notification-history-${testInfo.project.name}.png`,
    fullPage: true
  });
});
