import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("researcher analytics page", () => {
  test("renders the canonical layout, opens a drill drawer, and closes it", async ({ page }) => {
    await loginAs(page, "researcher");
    await page.goto("/analytics");

    await expect(page.getByTestId("analytics-title")).toHaveText("Analytics");
    await expect(page.getByTestId("analytics-viewing-as")).toHaveText("Researcher");

    // Toolbar primitives — LastSyncedBadge, DateRangePicker trigger,
    // GroupByChip, Save view (disabled in A1).
    await expect(page.getByTestId("analytics-toolbar")).toBeVisible();
    await expect(page.getByRole("button", { name: /Range:/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Group by:/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /\+ Save view/i })).toBeDisabled();

    // KPI strip — 5 KpiCards.
    const kpiStrip = page.getByTestId("analytics-kpi-strip");
    await expect(kpiStrip).toBeVisible();
    const kpiTitles = ["Used SUs", "Burn rate", "Days left", "Jobs run", "Avg wait"];
    for (const title of kpiTitles) {
      await expect(kpiStrip.getByText(title, { exact: true })).toBeVisible();
    }

    // ForecastBar and the exhaust caption.
    await expect(page.getByRole("heading", { name: /Burn vs allocated/i })).toBeVisible();
    await expect(page.getByTestId("analytics-exhaust-caption")).toBeVisible();

    // StackedAreaUsage.
    await expect(page.getByRole("heading", { name: /Daily SU consumption/i })).toBeVisible();
    const dailyChart = page.getByTestId("analytics-daily-chart");
    await expect(dailyChart).toBeVisible();

    // Recent jobs DataTable (top-25 cap by spec).
    const jobsTable = page.getByRole("table", { name: /Recent jobs/i });
    await expect(jobsTable).toBeVisible();
    await expect(jobsTable.locator("tbody tr").first()).toBeVisible();

    // Click the chart -> DrillStack drawer opens with a crumb back to the page.
    await dailyChart.click();
    const drillNav = page.getByRole("navigation", { name: /Drill breadcrumb/i });
    await expect(drillNav).toBeVisible();
    await expect(drillNav.getByRole("button", { name: /Researcher analytics/i })).toBeVisible();

    // Pop the drawer.
    await drillNav.getByRole("button", { name: /Researcher analytics/i }).click();
    await expect(drillNav).not.toBeVisible({ timeout: 5_000 });
  });
});
