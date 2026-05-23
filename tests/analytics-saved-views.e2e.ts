import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

// End-to-end coverage for Phase A4 (spec §9). Exercises the full create →
// reload → re-apply → delete loop against the MSW handlers, which persist
// to localStorage (goal-1 Phase 6 contract) so a reload survives.
test.describe("Saved analytics views", () => {
  test("PI persona can save, reload, re-apply, and delete a view", async ({ page }) => {
    await loginAs(page, "pi");
    await page.goto("/analytics");

    await expect(page.getByTestId("analytics-viewing-as")).toHaveText("PI");
    // Pre-seeded default view (`view-pi-weekly`) auto-applies 7d on first
    // visit (spec §9 Phase A4 default-on-load).
    await expect(page.getByRole("button", { name: /Last 7d/i })).toBeVisible({
      timeout: 10_000,
    });

    // Flip the Project group-by chip so the saved view captures a non-default
    // group_by alongside the default 7d preset.
    await page.getByRole("button", { name: /^Project:/i }).click();
    await page.getByRole("menuitem", { name: /By project/i }).click();
    await expect(page.getByRole("button", { name: /^Project: By project/i })).toBeVisible();

    // Open the save-view popover, name it, and submit.
    await page.getByTestId("analytics-save-view-trigger").click();
    const name = `Weekly review ${Date.now()}`;
    await page.getByTestId("analytics-save-view-name").fill(name);
    await page.getByTestId("analytics-save-view-submit").click();

    // The new chip appears in the row.
    const chipsStrip = page.getByTestId("analytics-saved-view-chips");
    await expect(chipsStrip.getByRole("button", { name, exact: true })).toBeVisible();

    // Reload — MSW persists the seed to localStorage (goal-1 Phase 6) so
    // the chip survives a full-page reload.
    await page.reload();
    await expect(page.getByTestId("analytics-viewing-as")).toHaveText("PI");
    await expect(
      page.getByTestId("analytics-saved-view-chips").getByRole("button", { name, exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    // Change the Project group-by back to All so re-applying the saved view
    // has a visible effect when we click the chip below.
    await page.getByRole("button", { name: /^Project:/i }).click();
    await page.getByRole("menuitem", { name: /All projects/i }).click();
    await expect(page.getByRole("button", { name: /^Project: All projects/i })).toBeVisible();

    // Click the chip — the Project chip should snap back to "By project".
    await chipsStrip.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("button", { name: /^Project: By project/i })).toBeVisible({
      timeout: 5_000,
    });

    // Open the chip's kebab and delete it.
    const chip = page
      .locator(`[data-testid^="saved-view-chip-"]`)
      .filter({ hasText: name });
    await chip.locator(`[data-testid$="-menu"]`).click();
    await page.getByRole("menuitem", { name: /^Delete$/i }).click();
    await expect(
      chipsStrip.getByRole("button", { name, exact: true }),
    ).toHaveCount(0, { timeout: 5_000 });
  });
});
