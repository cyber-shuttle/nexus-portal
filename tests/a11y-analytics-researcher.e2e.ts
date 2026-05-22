import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

const SEVERITIES = ["serious", "critical"] as const;

test.describe("analytics — researcher axe sweep", () => {
  test("/analytics has no serious or critical violations for researcher", async ({ page }) => {
    await loginAs(page, "researcher");
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .options({ resultTypes: ["violations"] })
      .analyze();
    const blocking = results.violations.filter((v) =>
      SEVERITIES.includes((v.impact ?? "minor") as (typeof SEVERITIES)[number]),
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
