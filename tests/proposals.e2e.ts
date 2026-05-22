import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("proposals", () => {
  test("pi walks through the wizard end-to-end and submits", async ({ page }) => {
    await loginAs(page, "pi");
    await page.goto("/proposals/new");
    await expect(page.getByRole("heading", { name: /^New proposal$/ })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel(/Project$/i).selectOption({ index: 1 });
    await page.getByLabel(/^Title$/i).fill("E2E proposal — milestone push");
    await page
      .getByLabel(/^Abstract$/i)
      .fill(
        "Quarterly extension to complete the BayesPrism integration milestone. Output is a paper draft and validated artifacts on the shared S3 bucket.",
      );
    await page.getByRole("button", { name: /^Next$/ }).click();

    await page.getByLabel(/Start date/i).fill("2026-06-01");
    await page.getByLabel(/End date/i).fill("2026-12-31");
    await page.getByRole("button", { name: /Add resource/i }).click();
    await page.getByRole("button", { name: /^Next$/ }).click();

    const justification =
      "We need extension capacity to complete the planned set of validation experiments for the BayesPrism scaling work. " +
      "The team has profiled the workload, validated checkpoints, and aligned with the allocation manager on weekly check-ins. " +
      "Approval unblocks the publication window and lets us hand off reproducible artifacts to the collaborator team on schedule. " +
      "Without it the deferral will cost an entire quarter. " +
      "We commit to monthly burn rate reports and a final retrospective at the end of the cycle. " +
      "This proposal also documents the planned set of regression tests we'll add to the CI pipeline before submission.";
    await page.getByLabel(/^Justification$/i).fill(justification);
    await page.getByRole("button", { name: /^Next$/ }).click();

    // Cascade step — leave the toggle off and continue.
    await page.getByRole("button", { name: /^Next$/ }).click();

    await expect(page.getByRole("heading", { name: /Review & submit/i })).toBeVisible();
    await page.getByRole("button", { name: /Submit proposal/i }).click();
    await expect(page.getByText(/Proposal submitted/i)).toBeVisible({ timeout: 15_000 });
    await page.waitForURL(/\/proposals\/prop-/);
    await expect(page.getByText("E2E proposal — milestone push")).toBeVisible();
  });

  test("admin opens a seeded submitted proposal and approves it", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/proposals");
    await expect(page.getByRole("heading", { name: /^Proposals$/ })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel(/^Status$/i).selectOption({ value: "SUBMITTED" });
    const firstRowLink = page.locator("tbody tr a").first();
    await expect(firstRowLink).toBeVisible({ timeout: 20_000 });
    await firstRowLink.click();

    await expect(page.getByRole("button", { name: /^Approve$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /^Approve$/ }).click();
    await page.getByRole("button", { name: /^Confirm$/ }).click();
    await expect(page.getByText(/Proposal approved/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/APPROVED/).first()).toBeVisible();
  });
});
