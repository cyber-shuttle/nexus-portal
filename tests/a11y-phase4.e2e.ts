import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

async function axeSweep(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .options({ resultTypes: ["violations"] })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

test.describe("phase 4 — axe sweep", () => {
  test("proposals list has no serious or critical violations", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/proposals");
    await expect(page.getByRole("heading", { name: /^Proposals$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForLoadState("networkidle");
    await axeSweep(page);
  });

  test("new proposal route has no serious or critical violations", async ({ page }) => {
    await loginAs(page, "pi");
    await page.goto("/proposals/new");
    await expect(page.getByRole("heading", { name: /^New proposal$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForLoadState("networkidle");
    await axeSweep(page);
  });

  test("tools landing has no serious or critical violations", async ({ page }) => {
    await loginAs(page, "pi");
    await page.goto("/tools");
    await expect(page.getByRole("heading", { name: /^Tools$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForLoadState("networkidle");
    await axeSweep(page);
  });

  test("credit transfer has no serious or critical violations", async ({ page }) => {
    await loginAs(page, "pi");
    await page.goto("/tools/credit-transfer");
    await expect(page.getByRole("heading", { name: /^Credit transfer$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForLoadState("networkidle");
    await axeSweep(page);
  });
});
