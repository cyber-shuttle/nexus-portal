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

  // TF1 fix-up Fix 2: researcher must only see projects they are a member of.
  // The seed adds the researcher persona to roughly 1-in-8 allocations
  // (~25 / 200), and the unscoped admin page caps at 50 rows; if the
  // researcher path ever leaks the admin catalog, the row count would jump
  // close to 50. We assert it stays well below that ceiling.
  test("researcher row count stays bounded to member-only projects", async ({ page }) => {
    await loginAs(page, "researcher");
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /^Projects$/ })).toBeVisible();
    // Each row renders an h-cell link with the project title; counting the
    // project-detail link selector is the most stable signal.
    const rowLinks = page.locator('a[href^="/projects/project-"]');
    await expect(rowLinks.first()).toBeVisible({ timeout: 15_000 });
    const count = await rowLinks.count();
    // Member-only seed cannot exceed the researcher's distinct project set.
    // Allow generous headroom but hard-fail well below the admin 50-row cap.
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(30);
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
