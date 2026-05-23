import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

// Seed: cluster-001 Nexus-A ENABLED, cluster-002 Nexus-B ENABLED,
// cluster-003 Nexus-Legacy DISABLED. The spec calls out Bridges-2/Anvil
// as example fixture names — we honor the actual seed here so the test
// stays stable when seed values evolve.
test.describe("Admin clusters tab", () => {
  test("/admin/resources lands on the Clusters tab with three seeded clusters", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    const response = await page.goto("/admin/resources");
    expect(response?.status()).toBe(200);

    // Page heading + the Clusters tab is the default (no ?tab= query param).
    await expect(
      page.getByRole("heading", { name: /^Resources & Clusters$/ }),
    ).toBeVisible({ timeout: 20_000 });

    // Match per-row testid so the assertion ignores the same name appearing
    // in the Location cell (Location placeholder mirrors the cluster name).
    await expect(page.getByTestId("cluster-row-cluster-001")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("cluster-row-cluster-002")).toBeVisible();
    await expect(page.getByTestId("cluster-row-cluster-003")).toBeVisible();

    // Three switches (one per row).
    await expect(page.getByRole("switch")).toHaveCount(3);
  });

  test("clicking an ENABLED cluster's toggle opens an impact dialog and the flip persists", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/resources");
    const nexusARow = page.getByTestId("cluster-row-cluster-001").locator("..").locator("..");
    await expect(nexusARow).toBeVisible({ timeout: 20_000 });

    const toggle = nexusARow.getByRole("switch");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();

    // Confirmation dialog with impact numbers.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Disable Nexus-A\?/)).toBeVisible();
    await dialog.getByRole("button", { name: "Disable" }).click();

    // Dialog closes and the toggle flips to disabled.
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(toggle).toHaveAttribute("aria-checked", "false", { timeout: 10_000 });

    // Reload to confirm the MSW persists the new status across refresh.
    await page.reload();
    const reloadedRow = page
      .getByTestId("cluster-row-cluster-001")
      .locator("..")
      .locator("..");
    await expect(reloadedRow.getByRole("switch")).toHaveAttribute("aria-checked", "false", {
      timeout: 20_000,
    });

    // Cleanup — re-enable Nexus-A so other tests in the same worker observe
    // the seeded default.
    await reloadedRow.getByRole("switch").click();
    await page.getByRole("dialog").getByRole("button", { name: "Enable" }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
  });

  test("status filter narrows the table to disabled clusters only", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/resources");
    await expect(page.getByTestId("cluster-row-cluster-003")).toBeVisible({ timeout: 20_000 });

    await page.getByLabel("Status").selectOption("DISABLED");
    await expect(page.getByTestId("cluster-row-cluster-003")).toBeVisible();
    await expect(page.getByTestId("cluster-row-cluster-001")).toBeHidden();
    await expect(page.getByTestId("cluster-row-cluster-002")).toBeHidden();
  });
});
