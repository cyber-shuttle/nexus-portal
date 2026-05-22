import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

const SEVERITIES = ["serious", "critical"] as const;

async function scan(page: import("@playwright/test").Page, route: string) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page })
    .options({ resultTypes: ["violations"] })
    .analyze();
  return results.violations.filter((v) =>
    SEVERITIES.includes((v.impact ?? "minor") as (typeof SEVERITIES)[number]),
  );
}

test.describe("allocation routes — axe sweep", () => {
  test("list / detail / tabs have no serious or critical violations", async ({ page }) => {
    await loginAs(page, "researcher");

    const violationsList = await scan(page, "/allocations");
    expect(violationsList, JSON.stringify(violationsList, null, 2)).toEqual([]);

    const firstAllocationLink = page
      .getByRole("link")
      .filter({ hasText: /BIO\d+/ })
      .first();
    if (await firstAllocationLink.count()) {
      const href = await firstAllocationLink.getAttribute("href");
      if (href) {
        const violationsDetail = await scan(page, href);
        expect(violationsDetail, JSON.stringify(violationsDetail, null, 2)).toEqual([]);

        const violationsUsers = await scan(page, `${href}?tab=users`);
        expect(violationsUsers, JSON.stringify(violationsUsers, null, 2)).toEqual([]);

        const violationsAudit = await scan(page, `${href}?tab=audit`);
        expect(violationsAudit, JSON.stringify(violationsAudit, null, 2)).toEqual([]);
      }
    }
  });
});
