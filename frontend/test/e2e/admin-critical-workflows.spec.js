import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const user = { id: "admin-1", name: "Admin User", email: "admin@example.com", role: "Admin", region: "All" };
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
  roles: ["Admin", "Area Manager", "Regional Manager", "Dealer"],
  regions: ["North", "South"],
  roleDefinitions: [],
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

async function expectNoSeriousAxe(page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
}

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
    (url) => url.pathname === "/api/bookings",
    (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rows: [booking] }) })
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

  await page.getByRole("button", { name: "Workflow Options" }).click();
  await expect(page.getByRole("heading", { name: "Area Fields", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Add option" }).click();
  await expect(page.getByRole("dialog", { name: /Add Booking Category option/i })).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.getByRole("button", { name: "Close add option" }).click();

  await page.getByRole("button", { name: "Access Management" }).click();
  await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Add Single User" }).click();
  await expect(page.getByRole("dialog", { name: "Add Single User" })).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.getByRole("button", { name: "Close Add Single User" }).click();
  await page.getByRole("button", { name: "Bulk Upload" }).click();
  await expect(page.getByRole("dialog", { name: "Bulk user onboarding" })).toBeVisible();
  await page.getByRole("button", { name: "Close user onboarding" }).click();

  await page.getByRole("button", { name: "Message Templates" }).click();
  await expect(page.getByRole("heading", { name: "Email Templates", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Delivery Logs" }).click();
  await expect(page.getByRole("heading", { name: "Email Delivery", level: 1 })).toBeVisible();
  await page.getByText("Activation campaign").click();
  await expect(page.getByRole("cell", { name: "manager@example.com" })).toBeVisible();
  await expectNoSeriousAxe(page);

  await page.getByRole("button", { name: "Email Configuration" }).click();
  await expect(page.getByRole("heading", { name: "Email Settings", level: 1 })).toBeVisible();
  await expect(page.getByText("sender@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByText("Stop Gmail delivery and remove the stored authorization?", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep connected" }).click();
  await expectNoSeriousAxe(page);
});
