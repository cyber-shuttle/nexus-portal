import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

const SEVERITIES = ["serious", "critical"] as const;

const ADMIN_ROUTES = [
  "/home",
  "/analytics",
  "/allocations",
  "/change-requests",
  "/proposals",
  "/tools",
  "/tools/credit-transfer",
  "/clients",
  "/signer/certificates",
  "/admin/amie/packets",
  "/admin/amie/failed",
  "/admin/amie/replies",
  "/admin/amie/reconcile",
  "/admin/resources",
  "/admin/rates",
  "/admin/unmapped-jobs",
  "/admin/adjustments",
  "/settings",
];

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
});
