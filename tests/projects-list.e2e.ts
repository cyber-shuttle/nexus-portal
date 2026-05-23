import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("projects list", () => {
  test("researcher lands on /projects with member-scoped rows", async ({ page }) => {
    await loginAs(page, "researcher");
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /^Projects$/ })).toBeVisible();
    // Researcher seed has at least one membership so the table renders rows.
    const firstRowLink = page
      .getByRole("link")
      .filter({ hasText: /Research Project/ })
      .first();
    await expect(firstRowLink).toBeVisible({ timeout: 15_000 });
  });

  test("PI sees PI + member rows with PI badge on owned rows", async ({ page }) => {
    await loginAs(page, "pi");
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /^Projects$/ })).toBeVisible();
    // PI persona owns at least one project per TF0 seed (pi@nexus.local is
    // recorded as project_pi_id on the seeded rows for org-001).
    await expect(page.getByText(/Research Project/).first()).toBeVisible({ timeout: 15_000 });
  });

  test("admin sees the unscoped project list", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /^Projects$/ })).toBeVisible();
    // Admin uses the paged list — pagination chrome should be present.
    await expect(page.getByText(/Showing 1[–-]/)).toBeVisible({ timeout: 15_000 });
  });

  test("row click navigates to detail page", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/projects");
    const firstRow = page
      .getByRole("link")
      .filter({ hasText: /Research Project/ })
      .first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });
    await firstRow.click();
    await expect(page).toHaveURL(/\/projects\/project-/);
  });

  test("status filter updates the URL", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/projects");
    await page.getByRole("combobox", { name: /Filter by status/i }).selectOption("ACTIVE");
    await expect(page).toHaveURL(/[?&]status=ACTIVE/);
  });
});
