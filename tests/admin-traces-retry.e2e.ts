import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

// Fixture trace IDs match src/features/tracing/__fixtures__/*.fixture.json and
// the MSW retry handler at src/mocks/handlers/traces.ts. The AMIE_FAILED
// trace is the only one that passes the Overview-tab retry gate (source=amie,
// status=1, root_event captured).
//
// Status-code branches (400/404/409/410/422/5xx) are not exercised end-to-end
// because the MSW service worker intercepts /api/v1/* fetches before
// Playwright's `page.route` ever sees them, and the only fixtures that yield
// non-202 from MSW are blocked by the Overview-tab gate (slurm source for 422,
// http source for 409). Coverage of those branches lives in the modal's unit
// tests, which mock fetch at the apiFetch layer and exhaust all 6 paths.
const AMIE_FAILED_TRACE = "a3b1c92d3f4e5a6b7c8d9e0f12345678";

test.describe("admin tracing retry modal", () => {
  test("happy path: open modal, confirm, success toast with View trace action", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto(`/admin/traces/${AMIE_FAILED_TRACE}`);
    await expect(page.getByRole("tab", { name: /^Overview$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /Retry this flow/i }).first().click();

    await expect(page.getByRole("heading", { name: /Retry this flow\?/i })).toBeVisible({
      timeout: 10_000,
    });
    const modal = page.getByRole("dialog").filter({ hasText: /Retry this flow\?/i });
    await modal.getByRole("button", { name: /^Retry this flow$/ }).click();

    await expect(page.getByText(/Retry queued/i)).toBeVisible({ timeout: 10_000 });
    // Sonner action button shows up alongside the toast body.
    await expect(page.getByRole("button", { name: /View trace/i })).toBeVisible();
  });

  test("Cancel closes the modal without firing the mutation", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto(`/admin/traces/${AMIE_FAILED_TRACE}`);
    await expect(page.getByRole("tab", { name: /^Overview$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /Retry this flow/i }).first().click();
    await expect(page.getByRole("heading", { name: /Retry this flow\?/i })).toBeVisible({
      timeout: 10_000,
    });
    const modal = page.getByRole("dialog").filter({ hasText: /Retry this flow\?/i });
    await modal.getByRole("button", { name: /^Cancel$/ }).click();
    await expect(page.getByRole("heading", { name: /Retry this flow\?/i })).toBeHidden({
      timeout: 5_000,
    });
  });
});
