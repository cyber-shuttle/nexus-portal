import { expect, test } from "@playwright/test";

test.describe("sign-in error banner", () => {
  test("renders banner with denied email and a retry control", async ({ page }) => {
    await page.goto("/sign-in?error=not_allowed&email=outsider%40example.org");

    // Scope to the named banner — Next's route announcer also uses role=alert.
    const banner = page.getByRole("alert", { name: /not on the allowlist/i });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("outsider@example.org");
    await expect(banner).toContainText(/not authorized to sign in/i);
    await expect(
      page.getByRole("button", { name: /try a different account/i }),
    ).toBeVisible();
  });
});
