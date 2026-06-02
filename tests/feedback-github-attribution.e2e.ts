import { type Page, expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

const SAMPLE_COMMENT = "This screen needs better spacing for readability.";

async function openFeedbackPanel(page: Page) {
  await page.getByRole("button", { name: /Suggestion mode/i }).click();
  const dialog = page.getByRole("dialog", { name: /Suggestion mode/i });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

// The full route round-trip (session token preferred over bot PAT, no
// credentials in the body) is covered by src/app/api/feedback/__tests__/
// route.test.ts — MSW Node can't intercept external https fetches issued
// from Next.js dev-mode route handlers, so e2e coverage at that layer was
// always lying. Here we only assert the lazy redirect actually fires.
test.describe("feedback github attribution", () => {
  test("credentials session redirects to GitHub OAuth on Submit", async ({ page }) => {
    await loginAs(page, "researcher");
    await page.goto("/home");
    const suggestion = page.getByRole("button", { name: /^Suggestion mode$/i });
    await expect(suggestion).toBeVisible();
    await expect(suggestion).toBeEnabled();

    const dialog = await openFeedbackPanel(page);
    const screenshot = dialog.getByRole("img", { name: /Captured screen/i });
    await expect(screenshot).toBeVisible({ timeout: 15_000 });
    await dialog.getByLabel(/Tell us what you'd suggest/i).fill(SAMPLE_COMMENT);

    // Without a github session the Submit click stashes the draft and kicks
    // off the GitHub OAuth dance. Intercept at the NextAuth signin endpoint
    // to avoid an actual round-trip to github.com in CI.
    const signinRequest = page.waitForRequest(
      (req) => req.url().includes("/api/auth/signin/github"),
      { timeout: 15_000 },
    );
    await dialog.getByRole("button", { name: /^Submit$/ }).click();
    await signinRequest;
  });
});
