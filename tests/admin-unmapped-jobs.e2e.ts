import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

// next-auth occasionally logs a benign `ClientFetchError` when its initial
// `/api/auth/session` probe races the page transition. It is unrelated to the
// Phase 7 HIGH H4 fix; filter it out so the assertion stays meaningful.
function isPortalRuntimeError(message: string): boolean {
  if (message.includes("ClientFetchError")) return false;
  if (message.includes("errors.authjs.dev")) return false;
  return true;
}

test.describe("Admin unmapped jobs", () => {
  test("unmapped-jobs Link action completes without a runtime crash", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => {
      if (isPortalRuntimeError(err.message)) consoleErrors.push(err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error" && isPortalRuntimeError(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });

    await loginAs(page, "admin");
    await page.goto("/admin/unmapped-jobs");
    await expect(page.getByRole("heading", { name: /^Unmapped jobs$/ })).toBeVisible({
      timeout: 20_000,
    });

    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 20_000 });
    const jobCell = firstRow.locator("td").first();
    const jobLabel = (await jobCell.innerText()).trim();

    // Open the resolve panel and pick the first allocation option.
    await firstRow.getByRole("button", { name: /^Resolve…/ }).click();
    const selector = firstRow.getByLabel(/Link .* to allocation/i);
    await expect(selector).toBeVisible();
    const allocationOptions = await selector.locator("option").allInnerTexts();
    expect(allocationOptions.length).toBeGreaterThan(1);

    // Pick the second option (index 0 is the placeholder).
    await selector.selectOption({ index: 1 });
    await firstRow.getByRole("button", { name: /^Link$/ }).click();

    // The toast should fire and the row should be gone.
    await expect(page.getByText(/^Linked /i)).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator("tbody tr").filter({ hasText: jobLabel.split("\n")[0] ?? jobLabel }),
    ).toHaveCount(0, { timeout: 10_000 });

    expect(consoleErrors).toEqual([]);
  });
});
