import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

const SEVERITIES = ["serious", "critical"] as const;

test.describe("analytics Resources tab — axe sweep", () => {
  test("/analytics?tab=resources has no serious or critical violations for admin", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/analytics?tab=resources");
    // Wait for the Resources surface title before scanning — the persona
    // switch container is async per-tab and the matrix renders only after
    // the per-allocation fan-out resolves.
    await expect(page.getByTestId("analytics-title")).toHaveText("Resources", {
      timeout: 20_000,
    });
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
