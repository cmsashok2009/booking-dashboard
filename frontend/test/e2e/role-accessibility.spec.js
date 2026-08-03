import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const roles = ["Admin", "Area Manager", "Regional Manager", "Dealer"];
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

for (const role of roles) {
  test(`${role} dashboard navigation and accessibility`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Role matrix runs once in Chromium.");

    const user = {
      id: role.toLowerCase().replaceAll(" ", "-"),
      name: `${role} User`,
      email: `${role.toLowerCase().replaceAll(" ", ".")}@example.com`,
      role,
      region: role === "Admin" ? "All" : "North"
    };
    const bootstrap = {
      currentUser: user,
      roles,
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

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();

    const adminItem = page.getByRole("button", { name: "User Management" });
    if (role === "Admin") await expect(adminItem).toBeVisible();
    else await expect(adminItem).toHaveCount(0);

    const bookingItem = page.getByRole("button", { name: "Booking Management" });
    await bookingItem.focus();
    await expect(bookingItem).toBeFocused();
    await bookingItem.press("Enter");
    await expect(page.getByRole("heading", { name: "All Bookings", level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
  });
}
