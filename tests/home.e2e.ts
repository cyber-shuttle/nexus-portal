import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("home dashboards", () => {
  test("researcher lands on home and sees the researcher dashboard variant", async ({ page }) => {
    await loginAs(page, "researcher");
    await page.goto("/home");

    const variant = page.locator(
      "[data-testid='researcher-dashboard-active'], [data-testid='researcher-dashboard-empty']",
    );
    await expect(variant).toBeVisible({ timeout: 20_000 });
  });

  test("pi lands on home and sees the PI dashboard", async ({ page }) => {
    await loginAs(page, "pi");
    await page.goto("/home");
    await expect(page.getByTestId("pi-dashboard")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Welcome,/ })).toBeVisible();
  });

  test("admin lands on home and sees the admin dashboard", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/home");
    await expect(page.getByTestId("admin-dashboard")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Site activity/i })).toBeVisible();
  });
});
