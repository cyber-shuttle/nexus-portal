import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

// Phase 5 ViewTraceLink integration. The AMIE PacketEvent, allocation
// AuditEvent, and change-request event-log schemas do NOT currently expose
// `trace_id` per the connector wire models — so the cross-feature wiring is
// blocked on a backend schema lift. These tests cover the linkable surfaces
// that DO carry trace_id today: the trace detail drawer's URL contract.
const AMIE_FAILED_TRACE = "a3b1c92d3f4e5a6b7c8d9e0f12345678";
const FIRST_SPAN = "1000000000000001";

test.describe("cross-link → trace deep-link", () => {
  test("navigating to /admin/traces/{id}?span={id} opens the drawer with the span pre-selected", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto(`/admin/traces/${AMIE_FAILED_TRACE}?span=${FIRST_SPAN}`);
    await expect(page.getByRole("tab", { name: /^Overview$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("tab", { name: /^Waterfall$/ }).click();
    // ?span= is consumed by the waterfall tab to scroll/select the row.
    await expect(page).toHaveURL(
      new RegExp(`/admin/traces/${AMIE_FAILED_TRACE}\\?.*\\bspan=${FIRST_SPAN}\\b`),
    );
  });

  test("from /admin/traces, opening a trace overlays via ?trace=<id>", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });
    await page
      .locator("tbody tr")
      .first()
      .getByRole("button", { name: /^View$/ })
      .click();
    await expect(page).toHaveURL(/\/admin\/traces\?.*trace=[0-9a-f]{32}/);
    await expect(page.getByRole("tab", { name: /^Overview$/ })).toBeVisible({
      timeout: 15_000,
    });
  });
});
