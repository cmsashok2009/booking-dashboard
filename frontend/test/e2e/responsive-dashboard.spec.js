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
  avlStatus: "Available",
  areaInputs: { bookingCategory: "Confirmed", wsPlanning: "Week 2" },
  regionalInputs: {}
};
const bootstrap = {
  currentUser: user,
  roles: ["Admin", "Area Manager", "Regional Manager", "Dealer"],
  regions: ["North", "South"],
  roleDefinitions: [],
  lookupOptions: {},
  users: [user],
  onboardingWorkflows: [],
  emailTemplates: [],
  emailTemplateSamples: [],
  emailCampaigns: [],
  emailProvider: { configured: false }
};
const widths = [320, 375, 768, 1024, 1440, 1920];

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Viewport matrix runs once in Chromium.");
  await page.addInitScript((sessionUser) => {
    window.sessionStorage.setItem("booking-dashboard-user", JSON.stringify(sessionUser));
  }, user);
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bootstrap) })
  );
  await page.route(
    (url) => url.pathname === "/api/bookings",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rows: [booking], total: 1 })
      })
  );
  await page.route("**/api/notifications", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ notifications: [], unreadCount: 0 })
    })
  );
  await page.route("**/api/notifications/stream", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'data: {"type":"snapshot","notifications":[]}\n\n'
    })
  );
});

test("authenticated dashboard remains usable at supported widths", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  for (const width of widths) {
    await page.setViewportSize({ width, height: width <= 375 ? 720 : 900 });
    const geometry = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      contentHeight: document.body.scrollHeight
    }));
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.contentHeight).toBeGreaterThan(0);
    await page.screenshot({
      path: "docs/evidence/screenshots/responsive-dashboard-" + width + ".png",
      fullPage: true,
      animations: "disabled"
    });
  }

  await page.setViewportSize({ width: 375, height: 720 });
  await expect(page.locator(".sidebar")).toBeHidden();
  const menuButton = page.getByRole("button", { name: "Open main navigation" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  const navigationDrawer = page.getByRole("dialog", { name: "Main navigation" });
  await expect(navigationDrawer).toBeVisible();
  await navigationDrawer.getByRole("button", { name: "Booking Management" }).click();
  await expect(navigationDrawer).toBeHidden();
  await expect(page.getByRole("heading", { name: "All Bookings", level: 1 })).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(menuButton).toBeHidden();
});

test("authenticated dashboard has no serious or critical Axe violations", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
});
