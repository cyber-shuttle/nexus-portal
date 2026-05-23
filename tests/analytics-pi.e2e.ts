import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("PI analytics page", () => {
  test("renders the PI variant with all 5 KPI cards, project regions, and a drill drawer", async ({
    page,
  }) => {
    await loginAs(page, "pi");
    await page.goto("/analytics");

    // Persona resolution: PI variant active and the viewing-as pill says PI.
    await expect(page.getByTestId("analytics-title")).toHaveText("Analytics");
    await expect(page.getByTestId("analytics-viewing-as")).toHaveText("PI");

    // Toolbar primitives — multi-chip GroupBy (Project + Member + Resource).
    await expect(page.getByTestId("analytics-toolbar")).toBeVisible();
    await expect(page.getByRole("button", { name: /Range:/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Project:/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Member:/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Resource:/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /\+ Save view/i })).toBeDisabled();

    // KPI strip — 5 KpiCards per §6.2.
    const kpiStrip = page.getByTestId("analytics-kpi-strip");
    await expect(kpiStrip).toBeVisible();
    const kpiTitles = [
      "Active projects",
      "Total SU used",
      "Avg burn /project",
      "Projects at risk",
      "Pending change-requests",
    ];
    for (const title of kpiTitles) {
      await expect(kpiStrip.getByText(title, { exact: true })).toBeVisible();
    }

    // Burn-by-project — at least one ForecastBar row.
    await expect(page.getByRole("heading", { name: /Burn by project/i })).toBeVisible();
    const burnRegion = page.getByTestId("pi-burn-by-project");
    await expect(burnRegion).toBeVisible();

    // Usage trend stacked area.
    await expect(page.getByRole("heading", { name: /Usage trend/i })).toBeVisible();
    await expect(page.getByRole("img", { name: /Usage trend stacked by project/i })).toBeVisible();

    // Two-up: member contribution + resource mix.
    await expect(page.getByRole("heading", { name: /Member contribution/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Resource mix/i })).toBeVisible();
    await expect(page.getByTestId("pi-member-contribution")).toBeVisible();

    // Projects table at the bottom.
    const projectsTable = page.getByRole("table", { name: /Projects rollup/i });
    await expect(projectsTable).toBeVisible();
    await expect(projectsTable.locator("tbody tr").first()).toBeVisible();

    // Click a member bar -> DrillStack opens with a crumb back to the page.
    const firstBar = page.getByTestId("pi-member-contribution").locator(".recharts-bar-rectangle").first();
    await firstBar.click({ force: true });
    const drillNav = page.getByRole("navigation", { name: /Drill breadcrumb/i });
    await expect(drillNav).toBeVisible();
    await expect(drillNav.getByRole("button", { name: /PI analytics/i })).toBeVisible();

    // Pop the drawer.
    await drillNav.getByRole("button", { name: /PI analytics/i }).click();
    await expect(drillNav).not.toBeVisible({ timeout: 5_000 });
  });
});
