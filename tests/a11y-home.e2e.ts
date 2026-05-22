import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { type Persona, loginAs } from "./fixtures/personas";

const SEVERITIES = ["serious", "critical"] as const;

const personas: Persona[] = ["researcher", "pi", "admin"];

test.describe("home — axe sweep", () => {
  for (const persona of personas) {
    test(`${persona} home page has no serious or critical violations`, async ({ page }) => {
      await loginAs(page, persona);
      await page.goto("/home");
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .options({ resultTypes: ["violations"] })
        .analyze();
      const blocking = results.violations.filter((v) =>
        SEVERITIES.includes((v.impact ?? "minor") as (typeof SEVERITIES)[number]),
      );
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });
  }
});
