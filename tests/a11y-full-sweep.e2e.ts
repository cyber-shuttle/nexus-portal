import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

const SEVERITIES = ["serious", "critical"] as const;

const ADMIN_ROUTES = [
  "/home",
  "/analytics",
  // TF3 — Resources tab on analytics. Wait for the tab content to mount before
  // axe scans so the matrix + KPI strip aren't half-rendered.
  "/analytics?tab=resources",
  "/allocations",
  "/change-requests",
  "/proposals",
  // TF1 — projects list. Detail route is covered by the seeded id sweep below.
  "/projects",
  "/tools",
  "/tools/credit-transfer",
  "/clients",
  "/signer/certificates",
  "/admin/amie/packets",
  "/admin/amie/failed",
  "/admin/amie/replies",
  "/admin/amie/reconcile",
  // TF2 — Clusters tab is the default on /admin/resources after the tabs
  // migration; the explicit `?tab=clusters` keeps the route key stable when
  // someone deep-links from elsewhere.
  "/admin/resources",
  "/admin/resources?tab=clusters",
  "/admin/rates",
  "/admin/unmapped-jobs",
  "/admin/adjustments",
  "/settings",
];

// Deep-link into a single seeded project so the detail route gets axe
// coverage in the sweep (the list-only scan misses every per-detail
// component). project-001 always exists in the seed (50 projects synthesized
// in src/mocks/seed/index.ts:211).
const SEEDED_PROJECT_DETAIL_ROUTE = "/projects/project-001";

test.describe("a11y — full sweep (admin sees every route)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  for (const route of ADMIN_ROUTES) {
    test(`admin ${route} has no serious or critical violations`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .options({ resultTypes: ["violations"] })
        .analyze();
      const blocking = results.violations.filter((v) =>
        SEVERITIES.includes((v.impact ?? "minor") as (typeof SEVERITIES)[number]),
      );
      expect(
        blocking,
        `axe violations on ${route}:\n${JSON.stringify(blocking, null, 2)}`,
      ).toEqual([]);
    });
  }

  test(`admin ${SEEDED_PROJECT_DETAIL_ROUTE} has no serious or critical violations`, async ({
    page,
  }) => {
    await page.goto(SEEDED_PROJECT_DETAIL_ROUTE);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .options({ resultTypes: ["violations"] })
      .analyze();
    const blocking = results.violations.filter((v) =>
      SEVERITIES.includes((v.impact ?? "minor") as (typeof SEVERITIES)[number]),
    );
    expect(
      blocking,
      `axe violations on ${SEEDED_PROJECT_DETAIL_ROUTE}:\n${JSON.stringify(blocking, null, 2)}`,
    ).toEqual([]);
  });
});
