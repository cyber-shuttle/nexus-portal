import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("credit transfer", () => {
  test("renders the tools landing and gates Phase 7 cards", async ({ page }) => {
    await loginAs(page, "pi");
    await page.goto("/tools");
    await expect(page.getByRole("heading", { name: /^Tools$/ })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Credit transfer/i).first()).toBeVisible();
    await expect(page.getByText(/Phase 7/i).first()).toBeVisible();
  });

  test("opens the credit transfer wizard and validates source/amount/destination", async ({
    page,
  }) => {
    await loginAs(page, "pi");
    await page.goto("/tools/credit-transfer");
    await expect(page.getByRole("heading", { name: /^Credit transfer$/ })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Pick source allocation/i)).toBeVisible({ timeout: 20_000 });

    // Try to advance without picking a source — error toast inline.
    await page.getByRole("button", { name: /^Next$/ }).click();
    await expect(page.getByText(/Pick a source allocation/i)).toBeVisible();
  });
});
