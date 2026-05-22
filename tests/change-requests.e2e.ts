import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("change requests", () => {
  test("pi submits an extension request and admin approves it from the queue", async ({ page }) => {
    const reason = `Need additional SUs for BayesPrism integration milestone push ${Date.now()}`;

    await loginAs(page, "pi");
    await page.goto("/allocations/alloc-001");
    await expect(page.getByRole("tab", { name: /Credits & Resources/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /Request extension/i }).click();
    await expect(page.getByRole("dialog", { name: /Request extension/i })).toBeVisible();

    await page.getByLabel(/Additional SUs requested/i).fill("12000");
    await page.getByLabel(/Reason/i).fill(reason);
    await page.getByRole("button", { name: /Submit request/i }).click();
    await expect(page.getByText(/Request submitted/i)).toBeVisible({ timeout: 10_000 });

    await page.goto("/change-requests");
    await expect(page.getByRole("heading", { name: /^Change requests$/ })).toBeVisible();
    await page.getByLabel(/Requester \/ reason/i).fill("pi@nexus.local");
    const piRow = page.getByRole("row").filter({ hasText: "pi@nexus.local" });
    await expect(piRow.first()).toBeVisible({ timeout: 15_000 });

    await page.context().clearCookies();

    await loginAs(page, "admin");
    await page.goto("/change-requests");
    await expect(page.getByRole("heading", { name: /^Change requests$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByLabel(/Requester \/ reason/i).fill("pi@nexus.local");
    const pendingRow = page
      .getByRole("row")
      .filter({ hasText: "pi@nexus.local" })
      .filter({ hasText: "PENDING" });
    await expect(pendingRow.first()).toBeVisible({ timeout: 15_000 });
    await pendingRow
      .first()
      .getByRole("button", { name: /^Approve/i })
      .click();
    await page.getByRole("button", { name: /^Confirm$/i }).click();
    await expect(page.getByText(/Approved 1 request/i)).toBeVisible({ timeout: 10_000 });
  });
});
