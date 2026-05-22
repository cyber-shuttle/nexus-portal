import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("phase 3 — axe sweep", () => {
  test("change-requests queue has no serious or critical violations", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/change-requests");
    await expect(page.getByRole("heading", { name: /^Change requests$/ })).toBeVisible({
      timeout: 20_000,
    });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test("allocation users tab has no serious or critical violations", async ({ page }) => {
    await loginAs(page, "pi");
    // Use a real PI allocation (see members.e2e for the same Phase 5 carry-over).
    await page.goto("/allocations/alloc-024");
    await page.getByRole("tab", { name: /Users & Roles/i }).click();
    await expect(page.getByTestId("add-member")).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .options({ resultTypes: ["violations"] })
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
