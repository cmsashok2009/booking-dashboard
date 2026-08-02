import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/ui-kit");
  await expect(page.getByRole("heading", { name: "UI Kit", level: 1 })).toBeVisible();
});

test("UI Kit primitives match the visual baseline", async ({ page }) => {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
  await expect(page).toHaveScreenshot("ui-kit-primitives.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide"
  });
});

test("UI Kit modal matches the visual baseline", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Overlay baselines run once in Chromium.");
  await page.getByRole("button", { name: "Open modal" }).click();
  await expect(page.getByRole("dialog", { name: "Shared modal" })).toBeVisible();
  await expect(page).toHaveScreenshot("ui-kit-modal.png", { animations: "disabled", caret: "hide" });
});

test("UI Kit drawer matches the visual baseline", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Overlay baselines run once in Chromium.");
  await page.getByRole("button", { name: "Open drawer" }).click();
  await expect(page.getByRole("dialog", { name: "Shared drawer" })).toBeVisible();
  await expect(page).toHaveScreenshot("ui-kit-drawer.png", { animations: "disabled", caret: "hide" });
});
