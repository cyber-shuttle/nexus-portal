import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

// Cluster filter propagation per spec §5.4. The portal-side contract is that
// every "new flow" selector pulls from `useEnabledClusters()` so a DISABLED
// cluster never appears. TF2 ships the hook + tab; the cluster *picker*
// surfaces (proposal wizard cluster step, allocation creation form, SSH cert
// allocation picker) are deferred — see TODOs in
// `src/features/proposals/api.ts` and `src/features/signer/api.ts`.
//
// This test asserts the propagation contract end-to-end against the admin
// table: when an admin disables Nexus-A, the Status=ENABLED view drops it
// (mirroring exactly what `useEnabledClusters` will surface to future
// pickers), while the unfiltered view still shows it (existing-allocation
// views continue to render disabled clusters per spec §12).
test.describe("Cluster filter propagation", () => {
  test("disabling Nexus-A removes it from the Enabled filter view", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/resources");
    const nexusARow = page.getByTestId("cluster-row-cluster-001").locator("..").locator("..");
    await expect(nexusARow).toBeVisible({ timeout: 20_000 });

    await nexusARow.getByRole("switch").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Disable cluster" })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    // Status=ENABLED view drops Nexus-A — the exact shape `useEnabledClusters`
    // produces for any future cluster picker (proposal wizard, allocation
    // creation form, SSH cert allocation picker).
    await page.getByLabel("Status").selectOption("ENABLED");
    await expect(page.getByTestId("cluster-row-cluster-001")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId("cluster-row-cluster-002")).toBeVisible();

    // Status=All still shows Nexus-A — existing-allocation views (allocation
    // detail, analytics) keep rendering the disabled cluster per spec §12.
    await page.getByLabel("Status").selectOption("");
    await expect(page.getByTestId("cluster-row-cluster-001")).toBeVisible({ timeout: 10_000 });

    // Cleanup: re-enable so the next test starts from the seeded baseline.
    const reloaded = page.getByTestId("cluster-row-cluster-001").locator("..").locator("..");
    await reloaded.getByRole("switch").click();
    await page.getByRole("dialog").getByRole("button", { name: "Enable cluster" }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
  });
});
