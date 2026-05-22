import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

// Phase 5 carry-over 0b: a credit transfer must update both allocations'
// balances AND push paired diff rows (one OUT, one IN, linked by transfer_id)
// that the audit tab surfaces. Before this fix, balances and audit were stale.
test.describe("credit transfer audit", () => {
  test("transfer between two pi allocations writes paired audit entries", async ({ page }) => {
    await loginAs(page, "pi");
    await page.goto("/tools/credit-transfer");
    await expect(page.getByRole("heading", { name: /^Credit transfer$/ })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Pick source allocation/i)).toBeVisible({
      timeout: 20_000,
    });

    // Pick the first eligible source.
    const sourceList = page.getByRole("list", { name: /Source allocations/i });
    const firstSource = sourceList.locator("li label").first();
    await expect(firstSource).toBeVisible({ timeout: 15_000 });
    const sourceLabel = (await firstSource.innerText()).trim();
    const sourceIdMatch = sourceLabel.match(/\balloc-\d{3,}\b/);
    expect(sourceIdMatch, "expected source label to expose an alloc-id").not.toBeNull();
    const sourceId = (sourceIdMatch ?? [""])[0] as string;
    await firstSource.locator("input").check();
    await page.getByRole("button", { name: /^Next$/ }).click();

    // Pick the first resource and an amount.
    await page.getByLabel(/^Resource$/i).selectOption({ index: 1 });
    await page.getByLabel(/SU amount/i).fill("500");
    await page.getByRole("button", { name: /^Next$/ }).click();

    // Pick the first available destination (skips the source).
    const destList = page.getByRole("list", { name: /Destination allocations/i });
    const firstDest = destList.locator("li label").first();
    await expect(firstDest).toBeVisible({ timeout: 15_000 });
    const destLabel = (await firstDest.innerText()).trim();
    const destIdMatch = destLabel.match(/\balloc-\d{3,}\b/);
    expect(destIdMatch, "expected destination label to expose an alloc-id").not.toBeNull();
    const destId = (destIdMatch ?? [""])[0] as string;
    await firstDest.locator("input").check();
    await page.getByRole("button", { name: /^Next$/ }).click();

    // Review + submit.
    await expect(page.getByRole("heading", { name: /Review/i })).toBeVisible();
    await page.getByRole("button", { name: /Confirm transfer/i }).click();
    await expect(page.getByRole("heading", { name: /Transfer complete/i })).toBeVisible({
      timeout: 15_000,
    });

    // Source audit log — needs admin to see the audit tab (PI's allocation
    // detail does not include the audit tab in the current portal).
    await page.context().clearCookies();
    await loginAs(page, "admin");
    await page.goto(`/allocations/${sourceId}`);
    await page.getByRole("tab", { name: /Audit log/i }).click();
    await expect(page.getByText(/CREDIT_TRANSFER_OUT/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goto(`/allocations/${destId}`);
    await page.getByRole("tab", { name: /Audit log/i }).click();
    await expect(page.getByText(/CREDIT_TRANSFER_IN/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
