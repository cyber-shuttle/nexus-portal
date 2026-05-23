import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("Admin analytics page", () => {
  test("renders the Admin variant with all 5 KPI cards and every region", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/analytics");

    // Persona resolution: Admin variant active.
    await expect(page.getByTestId("analytics-title")).toHaveText("Analytics");
    await expect(page.getByTestId("analytics-viewing-as")).toHaveText("Admin");

    // Toolbar primitives — 3 GroupBy chips (Resource + Project + Org).
    await expect(page.getByTestId("analytics-toolbar")).toBeVisible();
    await expect(page.getByRole("button", { name: /Range:/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Resource:/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Project:/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Org:/i })).toBeVisible();
    // A4: + Save view is enabled and opens the popover; the disabled
    // placeholder is gone.
    await expect(page.getByTestId("analytics-save-view-trigger")).toBeEnabled();

    // KPI strip — 5 KpiCards per §6.3.
    const kpiStrip = page.getByTestId("analytics-kpi-strip");
    await expect(kpiStrip).toBeVisible();
    const kpiTitles = [
      "Site SU used",
      "Cluster util %",
      "Active projects",
      "AMIE packets/day",
      "Failed packets (24h)",
    ];
    for (const title of kpiTitles) {
      await expect(kpiStrip.getByText(title, { exact: true })).toBeVisible();
    }

    // Cluster utilization stacked area.
    await expect(page.getByRole("heading", { name: /Cluster utilization/i })).toBeVisible();

    // Two-up: Top projects + AMIE packet flow.
    await expect(page.getByRole("heading", { name: /Top projects/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /AMIE packet flow/i })).toBeVisible();
    await expect(page.getByTestId("admin-amie-view-failed")).toBeVisible();

    // Compliance matrix.
    await expect(page.getByRole("heading", { name: /Allocation health matrix/i })).toBeVisible();
    const matrix = page.getByTestId("admin-compliance-matrix");
    await expect(matrix).toBeVisible();

    // At-risk allocations table.
    await expect(page.getByRole("heading", { name: /At-risk allocations/i })).toBeVisible();
  });

  test("compliance matrix cell click navigates to /allocations/:id?tab=credits", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/analytics");
    const matrix = page.getByTestId("admin-compliance-matrix");
    await expect(matrix).toBeVisible();

    // Find a non-empty (clickable) cell — clickable cells render as a button
    // with data-band other than "empty".
    const interactiveCell = matrix.locator('button[data-band]:not([data-band="empty"])').first();
    if (await interactiveCell.count() === 0) {
      test.skip(true, "No populated compliance cells in current seed window");
    }
    await interactiveCell.click();
    // F7: drill links forward the analytics range (`from` + `to`) alongside
    // the credits tab so the destination preserves the window.
    await expect(page).toHaveURL(/\/allocations\/[^?]+\?.*tab=credits/);
  });

  test("AMIE flow View failed link navigates with status filter", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/analytics");
    const link = page.getByTestId("admin-amie-view-failed");
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/admin\/amie\/packets\?status=FAILED/);
  });

  test("Analytics nav entry is visible in the sidebar for admin", async ({ page }) => {
    await loginAs(page, "admin");
    // Sidebar nav is on the home page; the entry should be slot 2.
    await page.goto("/home");
    const nav = page.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: /^Analytics$/i })).toBeVisible();
  });
});
