import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

const SEVERITIES = ["serious", "critical"] as const;

test.describe("admin clusters tab — axe sweep", () => {
  test("Clusters tab has no serious or critical violations", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/resources");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: /^Resources & Clusters$/ }),
    ).toBeVisible({ timeout: 20_000 });

    const results = await new AxeBuilder({ page })
      .options({ resultTypes: ["violations"] })
      .analyze();
    const serious = results.violations.filter((v) =>
      SEVERITIES.includes((v.impact ?? "minor") as (typeof SEVERITIES)[number]),
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
