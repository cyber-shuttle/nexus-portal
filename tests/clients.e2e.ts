import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("clients", () => {
  test("admin filters the list by status", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: /^Clients$/ })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel(/^Status$/i).selectOption({ value: "active" });
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 20_000 });
  });

  test("admin opens a client and rotates the secret", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: /^Clients$/ })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel(/^Status$/i).selectOption({ value: "active" });
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 20_000 });
    await firstRow.click();

    const rotateButton = page.getByRole("button", { name: /Rotate secret/i });
    await expect(rotateButton).toBeVisible({ timeout: 20_000 });
    await rotateButton.click();
    await expect(page.getByText(/Client secret rotated/i)).toBeVisible({ timeout: 10_000 });
  });
});
