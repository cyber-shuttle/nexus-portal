import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

// Covers the dev-credentials side of the two-axis nav layout: the admin
// persona stamps systemRole on the credentials path so the sidebar renders
// both top-level groups; researcher and PI personas only carry the
// allocation axis and therefore see a single group.

test.describe("system roles — dev personas", () => {
  test("admin persona sees both 'My allocations' and 'Site administration' nav groups", async ({
    page,
  }) => {
    await loginAs(page, "admin");

    await expect(page.getByText("My allocations", { exact: true })).toBeVisible();
    await expect(page.getByText("Site administration", { exact: true })).toBeVisible();

    // Allocation-axis link present for every signed-in persona.
    await expect(page.getByRole("link", { name: /^Overview$/ })).toBeVisible();
    // Admin-only items gated on session.systemRole === "admin".
    await expect(page.getByRole("link", { name: /AMIE Console/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Rates$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Resources$/ })).toBeVisible();
  });

  test("researcher persona hides 'Site administration' group and admin items", async ({
    page,
  }) => {
    await loginAs(page, "researcher");

    await expect(page.getByText("My allocations", { exact: true })).toBeVisible();
    await expect(page.getByText("Site administration", { exact: true })).toHaveCount(0);

    await expect(page.getByRole("link", { name: /^Overview$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /AMIE Console/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Rates$/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Resources$/ })).toHaveCount(0);
  });

  test("PI persona hides 'Site administration' group", async ({ page }) => {
    await loginAs(page, "pi");

    await expect(page.getByText("My allocations", { exact: true })).toBeVisible();
    await expect(page.getByText("Site administration", { exact: true })).toHaveCount(0);

    // Allocation-axis items are open to every signed-in persona; admin gating
    // is the only sidebar difference, so confirm admin items stay hidden.
    await expect(page.getByRole("link", { name: /^Overview$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Allocations$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Proposals$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /AMIE Console/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Rates$/ })).toHaveCount(0);
  });
});
