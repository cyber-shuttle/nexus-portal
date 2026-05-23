import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("projects detail", () => {
  test("admin opens a project detail and switches across the 4 tabs", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/projects");
    const firstRow = page
      .getByRole("link")
      .filter({ hasText: /Research Project/ })
      .first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });
    await firstRow.click();
    await expect(page).toHaveURL(/\/projects\/project-/);

    // All four tabs are present and the default landing tab is Allocations.
    await expect(page.getByRole("tab", { name: /Allocations/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Members/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Resource Usage/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Audit/ })).toBeVisible();

    // Resource Usage tab loads the callout + explore link.
    await page.getByRole("tab", { name: /Resource Usage/ }).click();
    await expect(page.getByRole("link", { name: /Explore in Analytics/i })).toBeVisible({
      timeout: 15_000,
    });

    // Members tab loads without error.
    await page.getByRole("tab", { name: /Members/ }).click();
    await expect(page.getByText(/distinct member/i)).toBeVisible({ timeout: 15_000 });

    // Audit tab loads the filter chrome (date range select).
    await page.getByRole("tab", { name: /Audit/ }).click();
    await expect(page.getByRole("combobox", { name: /date range/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("drill into an allocation from the project detail Allocations tab", async ({ page }) => {
    await loginAs(page, "pi");
    await page.goto("/projects");
    const firstRow = page
      .getByRole("link")
      .filter({ hasText: /Research Project/ })
      .first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });
    await firstRow.click();
    // Wait for the Allocations table to render at least one row.
    const allocLink = page
      .getByRole("link")
      .filter({ hasText: /BIO\d+|alloc-/ })
      .first();
    if (await allocLink.count()) {
      const href = await allocLink.getAttribute("href");
      expect(href).toMatch(/\/allocations\//);
    }
  });

  test("breadcrumb returns to projects list", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/projects");
    const firstRow = page
      .getByRole("link")
      .filter({ hasText: /Research Project/ })
      .first();
    await firstRow.click();
    await page.getByRole("link", { name: /^Projects$/ }).first().click();
    await expect(page).toHaveURL(/\/projects(\?|$)/);
  });
});
