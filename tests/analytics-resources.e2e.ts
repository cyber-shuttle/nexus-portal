import { expect, test } from "@playwright/test";
import { loginAs, type Persona } from "./fixtures/personas";

const PERSONAS: Persona[] = ["researcher", "pi", "admin"];

test.describe("/analytics Resources tab", () => {
  for (const persona of PERSONAS) {
    test(`${persona} sees Resources tab and core regions render`, async ({ page }) => {
      await loginAs(page, persona);
      await page.goto("/analytics");

      // Tab strip on every persona — default is Overview, Resources is the
      // new TF3 tab.
      const resourcesTab = page.getByRole("tab", { name: "Resources" });
      await expect(resourcesTab).toBeVisible({ timeout: 20_000 });
      await resourcesTab.click();
      await expect(page).toHaveURL(/[?&]tab=resources/);

      // Title + persona label flip to the Resources surface.
      await expect(page.getByTestId("analytics-title")).toHaveText("Resources", {
        timeout: 20_000,
      });
      const personaLabel =
        persona === "admin" ? "Admin" : persona === "pi" ? "PI" : "Researcher";
      await expect(page.getByTestId("analytics-viewing-as")).toHaveText(personaLabel);

      // Toolbar — date range, single group-by chip, saved-view trigger.
      const toolbar = page.getByTestId("analytics-resources-toolbar");
      await expect(toolbar).toBeVisible();
      await expect(toolbar.getByRole("button", { name: /Range:/i })).toBeVisible();
      await expect(toolbar.getByRole("button", { name: /^Group:/i })).toBeVisible();

      // KPI strip — Total SUs + Top resource + Top allocation + Most-active user.
      const kpiStrip = page.getByTestId("analytics-resources-kpi-strip");
      await expect(kpiStrip).toBeVisible();
      for (const title of ["Total SUs used", "Top resource", "Top allocation", "Most-active user"]) {
        await expect(kpiStrip.getByText(title, { exact: true })).toBeVisible();
      }

      // Most-used resource callout + Usage over time + matrix + consumers table.
      await expect(
        page.getByRole("heading", { name: "Most-used resource", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Usage over time" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Resource × Allocation matrix/ }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Top allocations" })).toBeVisible();
    });
  }

  test("group-by chip change rewrites URL and refetches", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/analytics?tab=resources");

    // Default group-by is Allocation.
    await expect(
      page.getByRole("heading", { name: /Resource × Allocation matrix/ }),
    ).toBeVisible({ timeout: 20_000 });

    // Open the Group chip and pick "By user".
    await page.getByRole("button", { name: /^Group:/i }).click();
    await page.getByRole("menuitem", { name: "By user" }).click();
    await expect(page).toHaveURL(/[?&]gb=user/);
    await expect(
      page.getByRole("heading", { name: /Resource × User matrix/ }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Top users" })).toBeVisible();
  });

  test("clicking the callout opens the drill drawer", async ({ page }) => {
    await loginAs(page, "researcher");
    await page.goto("/analytics?tab=resources");

    const callout = page.getByRole("region", { name: "Most-used resources" });
    await expect(callout).toBeVisible({ timeout: 20_000 });

    // First row of the callout — the top resource for the persona.
    const firstRow = callout.getByRole("button").first();
    await firstRow.click();

    // DrillStack opens with a back-crumb to the resources surface.
    const drillNav = page.getByRole("navigation", { name: /Drill breadcrumb/i });
    await expect(drillNav).toBeVisible({ timeout: 10_000 });
    await expect(drillNav.getByRole("button", { name: /Researcher resources/i })).toBeVisible();
  });
});
