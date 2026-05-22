import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

async function axeSweep(page: Page) {
  const results = await new AxeBuilder({ page })
    .options({ resultTypes: ["violations"] })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

test.describe("phase 5 — axe sweep", () => {
  test("certificates list has no serious or critical violations", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/signer/certificates");
    await expect(page.getByRole("heading", { name: /^SSH Certificates$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForLoadState("networkidle");
    await axeSweep(page);
  });

  test("certificate detail deep link has no serious or critical violations", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/signer/certificates");
    await expect(page.getByRole("heading", { name: /^SSH Certificates$/ })).toBeVisible({
      timeout: 20_000,
    });
    const serialCell = page.locator("tbody tr td").first();
    await expect(serialCell).toBeVisible({ timeout: 20_000 });
    const serial = (await serialCell.innerText()).trim();
    await page.goto(`/signer/certificates/${serial}`);
    await expect(
      page.getByRole("heading", { name: new RegExp(`Certificate ${serial}`) }),
    ).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState("networkidle");
    await axeSweep(page);
  });

  test("clients list has no serious or critical violations", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: /^Clients$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForLoadState("networkidle");
    await axeSweep(page);
  });
});
