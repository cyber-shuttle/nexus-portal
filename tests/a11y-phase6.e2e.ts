import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

const SEVERITIES = ["serious", "critical"] as const;

async function scan(page: import("@playwright/test").Page, route: string) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).options({ resultTypes: ["violations"] }).analyze();
  return results.violations.filter((v) =>
    SEVERITIES.includes((v.impact ?? "minor") as (typeof SEVERITIES)[number]),
  );
}

test.describe("AMIE routes — axe sweep", () => {
  test("inbox / failed / replies / reconcile have no serious or critical violations", async ({
    page,
  }) => {
    await loginAs(page, "admin");

    for (const route of [
      "/admin/amie/packets",
      "/admin/amie/failed",
      "/admin/amie/replies",
      "/admin/amie/reconcile",
    ]) {
      const violations = await scan(page, route);
      expect(violations, `${route}\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
    }
  });
});
