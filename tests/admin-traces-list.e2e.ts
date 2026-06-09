import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

const SEVERITIES = ["serious", "critical"] as const;

test.describe("admin traces list (Phase B)", () => {
  test("renders the page, default error filter, and at least one error row", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");

    await expect(page.getByRole("heading", { name: /^Traces$/ })).toBeVisible({
      timeout: 20_000,
    });

    // Default filter has the error chip pressed.
    await expect(page.getByRole("button", { name: /^error$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // The list fixture contains at least one error trace (status=1).
    const errorRows = page.locator('[data-testid^="trace-row-"][data-tone="error"]');
    await expect(errorRows.first()).toBeVisible({ timeout: 20_000 });
  });

  test("toggling to the ok pill updates the URL and re-fetches", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.getByRole("heading", { name: /^Traces$/ })).toBeVisible({
      timeout: 20_000,
    });

    // Turn off error, turn on ok → URL ends up with ?status=ok.
    await page.getByRole("button", { name: /^error$/i }).click();
    await page.getByRole("button", { name: /^ok$/i }).click();

    await expect(page).toHaveURL(/[?&]status=ok\b/, { timeout: 10_000 });

    // The table either shows ok rows or the filtered-empty copy. We only
    // assert that the loading skeleton goes away.
    await expect(page.getByTestId("trace-table-loading")).toHaveCount(0, { timeout: 15_000 });
  });

  test("clicking a row pushes ?trace=<id> (drawer is deferred to Phase C)", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.getByRole("heading", { name: /^Traces$/ })).toBeVisible({
      timeout: 20_000,
    });

    const firstRow = page.locator('[data-testid^="trace-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 20_000 });
    await firstRow.click();

    await expect(page).toHaveURL(/[?&]trace=[0-9a-f]{32}\b/, { timeout: 10_000 });
  });

  test("axe: no serious or critical violations on the list page", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.getByRole("heading", { name: /^Traces$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .options({ resultTypes: ["violations"] })
      .analyze();
    const blocking = results.violations.filter((v) =>
      SEVERITIES.includes((v.impact ?? "minor") as (typeof SEVERITIES)[number]),
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
