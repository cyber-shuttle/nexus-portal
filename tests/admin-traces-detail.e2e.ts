import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

const SEVERITIES = ["serious", "critical"] as const;

test.describe("admin tracing detail drawer", () => {
  test("row click opens the drawer with ?trace= and refresh preserves it", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.getByRole("heading", { name: /^Tracing$/ })).toBeVisible({
      timeout: 20_000,
    });
    // Wait for the table to settle.
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });

    const firstRow = page.locator("tbody tr").first();
    await firstRow.getByRole("button", { name: /^View$/ }).click();

    // Row click writes ?trace=<32-hex> without leaving /admin/traces so the
    // list stays mounted behind the drawer.
    await expect(page).toHaveURL(/\/admin\/traces\?.*trace=[0-9a-f]{32}/);

    // Drawer is the only Overview tab on the page.
    const overviewTab = page.getByRole("tab", { name: /^Overview$/ });
    await expect(overviewTab).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("tab", { name: /^Waterfall$/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Raw JSON$/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Linked$/ })).toBeVisible();

    // Refresh — drawer should still be open with the same trace param.
    const urlBefore = page.url();
    await page.reload();
    await expect(page).toHaveURL(urlBefore);
    await expect(page.getByRole("tab", { name: /^Overview$/ })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("close button removes ?trace= and returns to the list", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });
    await page.locator("tbody tr").first().getByRole("button", { name: /^View$/ }).click();
    await expect(page.getByRole("tab", { name: /^Overview$/ })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /^Close$/ }).click();
    // Close drops the `trace` search-param. /admin/traces is the bare list.
    await expect(page).toHaveURL(/\/admin\/traces($|\?(?!.*trace=))/, { timeout: 15_000 });
  });

  test("Waterfall tab renders the span tree when selected", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });
    await page.locator("tbody tr").first().getByRole("button", { name: /^View$/ }).click();
    await expect(page.getByRole("tab", { name: /^Overview$/ })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: /^Waterfall$/ }).click();
    await expect(page.getByRole("tree", { name: /Span waterfall/i })).toBeVisible();
  });

  test("deep-linking /admin/traces/{id} opens the drawer", async ({ page }) => {
    await loginAs(page, "admin");
    // Pull a trace_id from the list first so we don't hard-code one.
    await page.goto("/admin/traces");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });
    const traceIdButton = page
      .locator("tbody tr")
      .first()
      .getByRole("button", { name: /Copy trace ID [0-9a-f]{32}/ });
    const ariaLabel = (await traceIdButton.getAttribute("aria-label")) ?? "";
    const match = ariaLabel.match(/[0-9a-f]{32}/);
    expect(match).not.toBeNull();
    const traceId = match?.[0] ?? "";

    await page.goto(`/admin/traces/${traceId}`);
    await expect(page.getByRole("tab", { name: /^Overview$/ })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("axe-core passes on the drawer-open page", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });
    await page.locator("tbody tr").first().getByRole("button", { name: /^View$/ }).click();
    await expect(page.getByRole("tab", { name: /^Overview$/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.mouse.move(0, 0);
    const results = await new AxeBuilder({ page })
      .options({ resultTypes: ["violations"] })
      .analyze();
    const blocking = results.violations.filter((v) =>
      SEVERITIES.includes((v.impact ?? "minor") as (typeof SEVERITIES)[number]),
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test("waterfall: clicking a span row opens the DrillStack detail panel", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });
    await page.locator("tbody tr").first().getByRole("button", { name: /^View$/ }).click();
    await expect(page.getByRole("tab", { name: /^Overview$/ })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: /^Waterfall$/ }).click();
    const tree = page.getByRole("tree", { name: /Span waterfall/i });
    await expect(tree).toBeVisible({ timeout: 15_000 });

    const firstSpan = tree.getByRole("treeitem").first();
    await firstSpan.click();
    // DrillStack uses the SideDrawer breadcrumb pattern — assert the
    // breadcrumb root is visible.
    await expect(page.getByRole("navigation", { name: /Drill breadcrumb/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("waterfall: arrow-key navigation moves selection across rows", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/traces");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });
    await page.locator("tbody tr").first().getByRole("button", { name: /^View$/ }).click();
    await expect(page.getByRole("tab", { name: /^Overview$/ })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: /^Waterfall$/ }).click();
    const tree = page.getByRole("tree", { name: /Span waterfall/i });
    await expect(tree).toBeVisible({ timeout: 15_000 });

    const firstRow = tree.getByRole("treeitem").first();
    await firstRow.focus();
    await page.keyboard.press("ArrowDown");
    // ArrowDown URL-syncs `?span=<id>`; assert the search-param landed.
    await expect(page).toHaveURL(/[?&]span=[0-9a-f]{16}\b/, { timeout: 5_000 });
  });
});
