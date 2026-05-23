import { type Page, expect } from "@playwright/test";

export type Persona = "researcher" | "pi" | "admin";

const personaEmails: Record<Persona, string> = {
  researcher: "researcher@nexus.local",
  pi: "pi@nexus.local",
  admin: "admin@nexus.local",
};

export async function loginAs(page: Page, persona: Persona) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: new RegExp(personaEmails[persona], "i") }).click();
  await expect(page).toHaveURL(/\/home(\?|$)/, { timeout: 20_000 });
  // Park the mouse off-page so the persona-card y-coordinate does not land
  // on a recharts hotspot post-redirect and surface a tooltip mid-axe scan.
  await page.mouse.move(0, 0);
}
