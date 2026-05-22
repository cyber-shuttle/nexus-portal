import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("allocations", () => {
  test("researcher loads list, opens detail, and tabs through credits / users / audit", async ({
    page,
  }) => {
    await loginAs(page, "researcher");
    await page.goto("/allocations");
    await expect(page.getByRole("heading", { name: /^Allocations$/ })).toBeVisible();

    await expect(page.getByText(/No allocations yet|Allocation/).first()).toBeVisible({
      timeout: 15_000,
    });

    const firstAllocationLink = page
      .getByRole("link")
      .filter({ hasText: /BIO\d+/ })
      .first();
    await expect(firstAllocationLink).toBeVisible({ timeout: 15_000 });
    await firstAllocationLink.click();

    await expect(page.getByRole("tab", { name: /Credits & Resources/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Users & Roles/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Audit log/i })).toBeVisible();

    // Users & Roles is now the default tab (Figma §8), so the legend renders
    // without an extra click.
    await expect(page.getByText(/Roles: PI, Co-PI/i)).toBeVisible();

    await page.getByRole("tab", { name: /Credits & Resources/i }).click();
    await expect(page.getByRole("button", { name: /Request extension/i })).toBeVisible();

    await page.getByRole("tab", { name: /Audit log/i }).click();
    await expect(page.getByRole("combobox", { name: /date range/i })).toBeVisible();
  });
});
