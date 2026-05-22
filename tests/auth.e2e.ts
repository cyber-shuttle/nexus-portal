import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/personas";

test.describe("persona auth", () => {
  test("researcher signs in and does not see AMIE console nav", async ({ page }) => {
    await loginAs(page, "researcher");
    await expect(page.getByRole("link", { name: /^Overview$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /AMIE Console/i })).toHaveCount(0);
  });

  test("admin signs in and sees admin nav", async ({ page }) => {
    await loginAs(page, "admin");
    await expect(page.getByRole("link", { name: /AMIE Console/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Resources$/ })).toBeVisible();
  });

  test("pi signs in and sees Proposals", async ({ page }) => {
    await loginAs(page, "pi");
    await expect(page.getByRole("link", { name: /^Proposals$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /AMIE Console/i })).toHaveCount(0);
  });
});
