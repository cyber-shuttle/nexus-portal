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

// Drives the dev-only github-dev credentials provider directly via NextAuth's
// callback endpoint so tests can exercise the GitHub-attributed feedback path
// without a real OAuth dance.
export async function loginAsGithubUser(page: Page, persona: Persona = "researcher") {
  const email = personaEmails[persona];
  const csrfRes = await page.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const res = await page.request.post("/api/auth/callback/github-dev", {
    form: { email, csrfToken, callbackUrl: "/home", json: "true" },
  });
  if (!res.ok()) throw new Error(`github-dev sign-in failed: ${res.status()} ${await res.text()}`);
  // NextAuth's session cookie is set on the redirect response; under parallel
  // load the follow-up GET races the cookie write — retry until it sticks.
  let sessionJson: { provider?: string; user?: { email?: string } } | null = null;
  for (let i = 0; i < 10; i++) {
    const session = await page.request.get("/api/auth/session");
    sessionJson = (await session.json()) as { provider?: string; user?: { email?: string } };
    if (sessionJson?.provider === "github" && sessionJson?.user?.email === email) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  if (sessionJson?.provider !== "github" || sessionJson?.user?.email !== email) {
    throw new Error(`github-dev session not established: ${JSON.stringify(sessionJson)}`);
  }
  await page.goto("/home");
  await expect(page).toHaveURL(/\/home(\?|$)/, { timeout: 20_000 });
  await page.mouse.move(0, 0);
}
