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

test.describe("projects routes — axe sweep", () => {
  test("list + detail + 4 tabs have no serious or critical violations", async ({ page }) => {
    await loginAs(page, "admin");

    const violationsList = await scan(page, "/projects");
    expect(violationsList, JSON.stringify(violationsList, null, 2)).toEqual([]);

    const firstProjectLink = page
      .getByRole("link")
      .filter({ hasText: /Research Project/ })
      .first();
    if (await firstProjectLink.count()) {
      const href = await firstProjectLink.getAttribute("href");
      if (href) {
        const violationsDetail = await scan(page, href);
        expect(violationsDetail, JSON.stringify(violationsDetail, null, 2)).toEqual([]);

        const violationsMembers = await scan(page, `${href}?tab=members`);
        expect(violationsMembers, JSON.stringify(violationsMembers, null, 2)).toEqual([]);

        const violationsResources = await scan(page, `${href}?tab=resources`);
        expect(violationsResources, JSON.stringify(violationsResources, null, 2)).toEqual([]);

        const violationsAudit = await scan(page, `${href}?tab=audit`);
        expect(violationsAudit, JSON.stringify(violationsAudit, null, 2)).toEqual([]);
      }
    }
  });
});
