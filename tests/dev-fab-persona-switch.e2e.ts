import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

// S1 QA carry-over: the floating DEV affordance must actually swap sessions,
// not just open the popover. Verify by signing in as one persona and asserting
// the topbar + sidebar reflect the new persona after a switch.
test.describe("dev FAB persona switch", () => {
  test("switching to Site Admin updates topbar and sidebar", async ({ page }) => {
    await loginAs(page, "researcher");

    // Researcher does NOT see AMIE Console.
    await expect(page.getByRole("link", { name: /AMIE Console/i })).toHaveCount(0);

    await page.getByRole("button", { name: /^DEV$/ }).click();
    await page.getByRole("menuitem", { name: /Site Admin/i }).click();

    // Avatar pill shows admin email.
    await expect(page.getByText("admin@nexus.local")).toBeVisible({ timeout: 20_000 });
    // Sidebar exposes admin-only AMIE Console.
    await expect(page.getByRole("link", { name: /AMIE Console/i })).toBeVisible();
  });
});
