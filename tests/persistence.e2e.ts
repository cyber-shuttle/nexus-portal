import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

// Phase 5 carry-over 0a: MSW seed mutations must survive across a full
// sign-out + sign-in cycle. Before the persistence fix, the change request
// would be lost when the page reloaded and the seed module re-evaluated.
test.describe("seed persistence", () => {
  test("change request submitted as pi is visible to admin after re-login", async ({
    page,
  }) => {
    const reason = `Persistence probe — ${Date.now()}`;

    await loginAs(page, "pi");
    await page.goto("/allocations/alloc-001");
    await expect(page.getByRole("tab", { name: /Credits & Resources/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /Request extension/i }).click();
    await expect(page.getByRole("dialog", { name: /Request extension/i })).toBeVisible();
    await page.getByLabel(/Additional SUs requested/i).fill("9000");
    await page.getByLabel(/Reason/i).fill(reason);
    await page.getByRole("button", { name: /Submit request/i }).click();
    await expect(page.getByText(/Request submitted/i)).toBeVisible({ timeout: 10_000 });

    // Hard reload-equivalent: clear cookies, then sign in as admin from scratch.
    await page.context().clearCookies();
    await loginAs(page, "admin");

    await page.goto("/change-requests");
    await expect(page.getByRole("heading", { name: /^Change requests$/ })).toBeVisible({
      timeout: 20_000,
    });
    // The reason isn't rendered in the table — we search by reason text in the
    // free-text input (which searches reason + requester_id) and confirm at
    // least one PI row appears for alloc-001 with the PENDING status. If the
    // mutation hadn't persisted, the table would be empty after the filter.
    await page.getByLabel(/Requester \/ reason/i).fill(reason);
    const row = page
      .getByRole("row")
      .filter({ hasText: "pi@nexus.local" })
      .filter({ hasText: "PENDING" });
    await expect(row.first()).toBeVisible({ timeout: 15_000 });
  });
});
