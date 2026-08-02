import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("UI Kit reflows at 200 and 400 percent equivalents", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Zoom-equivalent matrix runs once in Chromium.");
  for (const zoom of [
    { percent: 200, width: 640 },
    { percent: 400, width: 320 }
  ]) {
    await page.setViewportSize({ width: zoom.width, height: 800 });
    await page.goto("/ui-kit");
    await expect(page.getByRole("heading", { name: "UI Kit", level: 1 })).toBeVisible();
    const geometry = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    await page.screenshot({
      path: `docs/evidence/screenshots/ui-kit-zoom-${zoom.percent}.png`,
      fullPage: true,
      animations: "disabled"
    });
  }
});

test("forced-colors mode preserves focus and semantics", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Forced-colors evidence runs once in Chromium.");
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/ui-kit");
  const button = page.getByRole("button", { name: "Primary" });
  await button.focus();
  await expect(button).toBeFocused();
  const focus = await button.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { outlineStyle: styles.outlineStyle, outlineWidth: styles.outlineWidth };
  });
  expect(focus.outlineStyle).not.toBe("none");
  expect(focus.outlineWidth).not.toBe("0px");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
  await page.screenshot({
    path: "docs/evidence/screenshots/ui-kit-forced-colors.png",
    fullPage: true,
    animations: "disabled"
  });
});

test("reduced motion disables overlay animation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Motion preference evidence runs once in Chromium.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ui-kit");
  await page.getByRole("button", { name: "Open drawer" }).click();
  const drawer = page.getByRole("dialog", { name: "Shared drawer" });
  await expect(drawer).toBeVisible();
  const animations = await drawer.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { animationName: styles.animationName, animationDuration: styles.animationDuration };
  });
  expect(animations.animationName).toBe("none");
  expect(animations.animationDuration).toBe("0s");
});
