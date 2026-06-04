import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

const SEVERITIES = ["serious", "critical"] as const;

test.describe("admin tracing list page", () => {
  test("admin lands on /admin/traces, filters by status, and opens a trace", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");

    await expect(page.getByRole("heading", { name: /^Tracing$/ })).toBeVisible({
      timeout: 20_000,
    });

    // Trend chart and at least one table row must render from MSW fixtures.
    await expect(page.getByLabel(/Trace counts per day grouped by status/i)).toBeVisible({
      timeout: 15_000,
    });
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });

    // Click the "error" status chip and verify the URL gains the filter.
    await page.getByRole("button", { name: /^error$/ }).click();
    await expect(page).toHaveURL(/[?&]status=1\b/);

    // Click "View" on the first remaining row — Phase 3 opens the drawer
    // via a `?trace=<id>` search-param update (avoids a route flash);
    // deep-link `/admin/traces/<id>` still works for inbound cross-links.
    await page
      .locator("tbody tr")
      .first()
      .getByRole("button", { name: /^View$/ })
      .click();
    await expect(page).toHaveURL(/[?&]trace=[0-9a-f]{32}/, { timeout: 15_000 });
  });

  test("admin tracing list passes axe-core sweep", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.getByRole("heading", { name: /^Tracing$/ })).toBeVisible({
      timeout: 20_000,
    });
    // Wait for the trend chart aria-label to render — a deterministic marker
    // that the page has finished its async paint, replacing networkidle.
    await expect(page.getByLabel(/Trace counts per day grouped by status/i)).toBeVisible({
      timeout: 15_000,
    });
    // Park the mouse off-canvas so a stray Recharts hover tooltip doesn't
    // surface during the scan.
    await page.mouse.move(0, 0);
    const results = await new AxeBuilder({ page })
      .options({ resultTypes: ["violations"] })
      .analyze();
    const blocking = results.violations.filter((v) =>
      SEVERITIES.includes((v.impact ?? "minor") as (typeof SEVERITIES)[number]),
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
