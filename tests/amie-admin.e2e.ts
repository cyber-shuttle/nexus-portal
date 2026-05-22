import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("AMIE admin console", () => {
  test("admin browses inbox, filters by FAILED, opens detail drawer with 4 tabs", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/amie/packets");
    await expect(page.getByRole("heading", { name: /AMIE packet inbox/i })).toBeVisible({
      timeout: 20_000,
    });

    // The trend chart and at least one row must render.
    await expect(page.getByLabel(/AMIE packets per day/i)).toBeVisible({ timeout: 15_000 });
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });

    // Filter to FAILED — the sticky 36h packet should be present.
    await page.getByLabel(/^Status$/).selectOption({ value: "FAILED" });
    await page.getByRole("button", { name: /^Apply$/ }).click();
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });

    // Open the first failed packet's drawer via its explicit View button.
    await page
      .locator("tbody tr")
      .first()
      .getByRole("button", { name: /^View$/ })
      .click();
    await expect(page.getByRole("tab", { name: /Overview/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("tab", { name: /Raw JSON/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Timeline/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Linked entity/i })).toBeVisible();

    // Switch to Raw JSON tab and confirm the payload region renders.
    await page.getByRole("tab", { name: /Raw JSON/i }).click();
    await expect(page.getByText(/packet_type/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("admin reconciles an unmapped packet by linking it to a project", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/amie/reconcile");
    await expect(page.getByRole("heading", { name: /Reconciliation queue/i })).toBeVisible({
      timeout: 20_000,
    });

    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });

    // Capture the AMIE ID of the first row so we can confirm it disappears.
    const amieIdCell = firstRow.locator("td").nth(0);
    const amieId = (await amieIdCell.innerText()).trim();

    // Fill the entity id and link.
    await firstRow.getByRole("textbox", { name: /Entity id for /i }).fill("BIO130001");
    await firstRow.getByRole("button", { name: /^Link$/ }).click();

    // Toast surfaces success and the row disappears from the queue.
    await expect(page.getByText(/Linked to project BIO130001/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("row").filter({ hasText: amieId })).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  test("admin retries a failed packet from the failed queue", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/amie/failed");
    await expect(page.getByRole("heading", { name: /Failed packet queue/i })).toBeVisible({
      timeout: 20_000,
    });

    // Sticky banner from the 36h packet should be visible.
    await expect(page.getByText(/older than 24 hours need attention/i)).toBeVisible({
      timeout: 10_000,
    });

    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });
    await firstRow.getByRole("button", { name: /^Retry$/ }).click();
    await expect(page.getByText(/Retry queued/i)).toBeVisible({ timeout: 10_000 });
  });
});
