import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("signer / certificates", () => {
  test("researcher browses the list and opens a detail drawer", async ({ page }) => {
    await loginAs(page, "researcher");
    await page.goto("/signer/certificates");
    await expect(page.getByRole("heading", { name: /^SSH Certificates$/ })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel(/^Status$/i).selectOption({ value: "active" });
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 20_000 });
  });

  test("admin filters by status, opens detail drawer, and revokes a certificate", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/signer/certificates");
    await expect(page.getByRole("heading", { name: /^SSH Certificates$/ })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel(/^Status$/i).selectOption({ value: "active" });
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 20_000 });
    await firstRow.click();

    await expect(page.getByRole("button", { name: /^Revoke$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /^Revoke$/ }).click();

    await expect(page.getByRole("heading", { name: /Revoke certificate\?/i })).toBeVisible();
    await page.getByLabel(/^Reason$/i).fill("Suspected key compromise — e2e test");
    await page.getByRole("button", { name: /Confirm revoke/i }).click();
    await expect(page.getByText(/Certificate \d+ revoked/i)).toBeVisible({ timeout: 10_000 });
  });

  test("certificate detail deep link renders the drawer", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/signer/certificates");
    await expect(page.getByRole("heading", { name: /^SSH Certificates$/ })).toBeVisible({
      timeout: 20_000,
    });

    const serialCell = page.locator("tbody tr td").first();
    await expect(serialCell).toBeVisible({ timeout: 20_000 });
    const serial = (await serialCell.innerText()).trim();
    expect(serial).toMatch(/^\d+$/);

    await page.goto(`/signer/certificates/${serial}`);
    await expect(
      page.getByRole("heading", { name: new RegExp(`Certificate ${serial}`) }),
    ).toBeVisible({ timeout: 20_000 });
  });
});
