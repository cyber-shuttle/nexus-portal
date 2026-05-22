import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("members", () => {
  test("pi adds a member, deactivates them, and removes them", async ({ page }) => {
    await loginAs(page, "pi");
    // alloc-024 is one of Pat PI's seeded allocations after persona scopes
    // moved from a hardcoded ["alloc-001"] to seed-derived in Phase 5.
    await page.goto("/allocations/alloc-024");
    await page.getByRole("tab", { name: /Users & Roles/i }).click();
    await expect(page.getByTestId("add-member")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState("networkidle");

    const rowsBefore = await page.locator("tbody tr").count();

    await page.getByTestId("add-member").click();
    await expect(page.getByRole("dialog", { name: /Add member/i })).toBeVisible();
    await page.getByPlaceholder(/Search by name or email/i).fill("nexus.local");
    const firstOption = page.getByTestId("user-option").first();
    await expect(firstOption).toBeVisible({ timeout: 10_000 });
    const newMemberEmail = (await firstOption.locator(".text-xs").textContent())?.trim() ?? "";
    expect(newMemberEmail.length).toBeGreaterThan(0);
    await firstOption.click();
    await page.getByRole("button", { name: /^Add member$/i }).click();
    await expect(page.getByText(/added$/i).first()).toBeVisible({ timeout: 10_000 });

    await expect.poll(() => page.locator("tbody tr").count()).toBe(rowsBefore + 1);

    const newRow = page.getByRole("row").filter({ hasText: newMemberEmail });
    await expect(newRow.first()).toBeVisible({ timeout: 10_000 });

    await newRow
      .first()
      .getByRole("button", { name: /^Deactivate$/i })
      .click();
    await page.getByTestId("confirm-action").click();
    await expect(page.getByText(/deactivated/i)).toBeVisible({ timeout: 10_000 });
    await expect(newRow.first().getByText(/INACTIVE/)).toBeVisible({ timeout: 10_000 });

    await newRow
      .first()
      .getByRole("button", { name: /^Remove$/i })
      .click();
    await page.getByTestId("confirm-action").click();
    await expect(page.getByText(/removed/i)).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => page.locator("tbody tr").count()).toBe(rowsBefore);
  });
});
