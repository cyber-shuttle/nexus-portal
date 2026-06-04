import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

// Phase 4B scenarios — isolated from admin-traces-detail.e2e.ts to keep the
// two parallel implementers' e2e edits from colliding.
const AMIE_FAILED_TRACE = "a3b1c92d3f4e5a6b7c8d9e0f12345678";
const HTTP_TRACE = "c5d3eb4f516a7b8c9d0e1f2345678901";

test.describe("admin tracing detail — raw json + linked entities tabs", () => {
  test("raw json tab: copy button copies the full trace document", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await loginAs(page, "admin");
    await page.goto(`/admin/traces/${AMIE_FAILED_TRACE}`);
    await expect(page.getByRole("tab", { name: /^Raw JSON$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("tab", { name: /^Raw JSON$/ }).click();
    await expect(page.getByRole("heading", { name: /^Raw JSON$/ })).toBeVisible();

    await page.getByRole("button", { name: /Copy JSON/i }).click();
    // Sonner toast — the most resilient signal across browsers.
    await expect(page.getByText(/Copied trace JSON/i)).toBeVisible({ timeout: 5_000 });
  });

  test("linked entities tab: amie packet card has a deep link to /admin/amie/packets/{id}", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto(`/admin/traces/${AMIE_FAILED_TRACE}`);
    await expect(page.getByRole("tab", { name: /^Linked$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("tab", { name: /^Linked$/ }).click();
    const openPacket = page.getByRole("link", { name: /Open packet/i });
    await expect(openPacket).toBeVisible({ timeout: 10_000 });
    await expect(openPacket).toHaveAttribute("href", /\/admin\/amie\/packets\//);
  });

  test("linked entities tab: comanage.email is hidden by default behind a Show contact info toggle", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto(`/admin/traces/${AMIE_FAILED_TRACE}`);
    await expect(page.getByRole("tab", { name: /^Linked$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("tab", { name: /^Linked$/ }).click();
    await expect(page.getByText(/Show contact info/i)).toBeVisible({ timeout: 10_000 });
    // The email lives inside a closed <details>; not visible until toggled.
    await expect(page.getByText("alice@example.org")).toBeHidden();
    await page.getByText(/Show contact info/i).click();
    await expect(page.getByText("alice@example.org")).toBeVisible();
  });

  test("linked entities tab: http-only fixture renders the HTTP request card", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto(`/admin/traces/${HTTP_TRACE}`);
    await expect(page.getByRole("tab", { name: /^Linked$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("tab", { name: /^Linked$/ }).click();
    await expect(page.getByText(/HTTP request/i)).toBeVisible({ timeout: 10_000 });
  });

  test("linked entities tab: empty audit-events message when none are written for this trace", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto(`/admin/traces/${HTTP_TRACE}`);
    await expect(page.getByRole("tab", { name: /^Linked$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("tab", { name: /^Linked$/ }).click();
    await expect(page.getByText("No audit events written under this trace.")).toBeVisible({
      timeout: 10_000,
    });
  });
});
