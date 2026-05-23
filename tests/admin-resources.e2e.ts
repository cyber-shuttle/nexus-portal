import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

// next-auth occasionally logs a benign `ClientFetchError` when its initial
// `/api/auth/session` probe races the page transition. It is unrelated to the
// Phase 7 HIGH H2 fix; filter it out so the assertion stays meaningful.
function isPortalRuntimeError(message: string): boolean {
  if (message.includes("ClientFetchError")) return false;
  if (message.includes("errors.authjs.dev")) return false;
  return true;
}

test.describe("Admin resources route", () => {
  test("/admin/resources renders the resources table for an admin", async ({ page }) => {
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
    // TF2 added a TabsRouter — the Resources content lives behind ?tab=resources
    // (Clusters is now the default tab).
    const response = await page.goto("/admin/resources?tab=resources");
    expect(response?.status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: /^Resources & Clusters$/ }),
    ).toBeVisible({ timeout: 20_000 });

    // The Resources tab keeps its existing filter form + table.
    await expect(page.getByLabel(/^Cluster$/)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 20_000 });

    // No serious console errors from the schema-validation widening or
    // anywhere else on the page.
    expect(consoleErrors).toEqual([]);
  });
});
