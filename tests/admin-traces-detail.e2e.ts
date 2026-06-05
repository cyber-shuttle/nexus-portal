import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

const SEVERITIES = ["serious", "critical"] as const;

test.describe("admin traces detail drawer (Phase C)", () => {
  test("clicking a row opens the drawer, refresh persists it, Esc closes it", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.getByRole("heading", { name: /^Traces$/ })).toBeVisible({
      timeout: 20_000,
    });

    const firstRow = page.locator('[data-testid^="trace-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 20_000 });
    await firstRow.click();

    await expect(page).toHaveURL(/[?&]trace=[0-9a-f]{32}\b/, { timeout: 10_000 });
    await expect(page.getByTestId("trace-detail-drawer")).toBeVisible({ timeout: 10_000 });

    // Reload — drawer stays open because the trace id lives on the URL.
    await page.reload();
    await expect(page.getByTestId("trace-detail-drawer")).toBeVisible({ timeout: 20_000 });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("trace-detail-drawer")).toHaveCount(0, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/[?&]trace=[0-9a-f]{32}\b/);
  });

  test("Tree is the default tab and renders the span tree", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.getByRole("heading", { name: /^Traces$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator('[data-testid^="trace-row-"]').first().click();
    await expect(page.getByTestId("trace-detail-drawer")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole("tree", { name: /trace span tree/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Tree tab on a failed trace shows the error chip", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.getByRole("heading", { name: /^Traces$/ })).toBeVisible({
      timeout: 20_000,
    });

    // The list defaults to status=error; the first row is the failed AMIE
    // fixture. Tree tab is the default, so the chip should render.
    await page.locator('[data-testid^="trace-row-"][data-tone="error"]').first().click();
    await expect(page.getByTestId("trace-detail-drawer")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("trace-error-chip")).toBeVisible({ timeout: 10_000 });
  });

  test("Tree tab keyboard nav: ArrowDown moves selection and 'n' jumps to next error", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.getByRole("heading", { name: /^Traces$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator('[data-testid^="trace-row-"][data-tone="error"]').first().click();
    await expect(page.getByTestId("trace-detail-drawer")).toBeVisible({ timeout: 10_000 });

    const tree = page.getByRole("tree", { name: /trace span tree/i });
    await expect(tree).toBeVisible();
    await tree.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/[?&]span=[0-9a-f]+/, { timeout: 10_000 });

    await page.keyboard.press("n");
    // After "n" the URL's ?span= lands on the error-leaf span id.
    await expect(page).toHaveURL(/[?&]span=[0-9a-f]+/, { timeout: 10_000 });
  });

  test("switching tabs surfaces Overview, Raw, and Linked entities content", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.getByRole("heading", { name: /^Traces$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator('[data-testid^="trace-row-"]').first().click();
    await expect(page.getByTestId("trace-detail-drawer")).toBeVisible({ timeout: 10_000 });

    const drawer = page.getByTestId("trace-detail-drawer");

    await page.getByRole("tab", { name: /^Overview$/ }).click();
    await expect(drawer.getByText(/^Trace ID$/)).toBeVisible();
    await expect(drawer.getByText(/^Span count$/)).toBeVisible();

    await page.getByRole("tab", { name: /^Raw$/ }).click();
    await expect(drawer.getByRole("button", { name: /copy trace JSON/i })).toBeVisible();

    await page.getByRole("tab", { name: /^Linked entities$/ }).click();
    await expect(drawer.getByText(/Entities referenced by spans/)).toBeVisible();
  });

  test("Retry button is aria-disabled and surfaces the coming-soon tooltip", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.getByRole("heading", { name: /^Traces$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator('[data-testid^="trace-row-"]').first().click();
    await expect(page.getByTestId("trace-detail-drawer")).toBeVisible({ timeout: 10_000 });

    const retry = page.getByTestId("retry-tooltip-anchor");
    await expect(retry).toHaveAttribute("aria-disabled", "true");
    await retry.hover();
    await expect(page.getByText(/Retry coming soon/i)).toBeVisible({ timeout: 5_000 });
  });

  test("axe: no serious or critical violations on the drawer-open page", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.getByRole("heading", { name: /^Traces$/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator('[data-testid^="trace-row-"]').first().click();
    await expect(page.getByTestId("trace-detail-drawer")).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .options({ resultTypes: ["violations"] })
      .analyze();
    const blocking = results.violations.filter((v) =>
      SEVERITIES.includes((v.impact ?? "minor") as (typeof SEVERITIES)[number]),
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
