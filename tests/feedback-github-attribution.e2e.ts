import { type Page, expect, test } from "@playwright/test";
import { loginAs, loginAsGithubUser } from "./fixtures/personas";

const SAMPLE_COMMENT = "This screen needs better spacing for readability.";

async function openFeedbackPanel(page: Page) {
  await page.getByRole("button", { name: /Suggestion mode/i }).click();
  const dialog = page.getByRole("dialog", { name: /Suggestion mode/i });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

async function drawOnOverlay(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const svg = page.getByRole("img", { name: /Annotation surface/i });
  await expect(svg).toBeVisible({ timeout: 10_000 });
  const box = await svg.boundingBox();
  if (!box) throw new Error("Annotation surface has no bounding box");
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + (from.x + to.x) / 2, box.y + (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 5 });
  await page.mouse.up();
}

// Serial keeps github-attributed submissions out of MSW's concurrent fetch
// pool — parallel submits race the dev-mode interceptor and miss intercepts.
test.describe.serial("feedback github attribution", () => {
  test("github-attributed session sends the user's bearer token to the issues API", async ({
    page,
  }) => {
    await loginAsGithubUser(page, "researcher");

    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /^Projects$/ })).toBeVisible();

    const suggestion = page.getByRole("button", { name: /Suggestion mode/i });
    await expect(suggestion).toBeEnabled();

    const dialog = await openFeedbackPanel(page);
    const screenshot = dialog.getByRole("img", { name: /Captured screen/i });
    await expect(screenshot).toBeVisible({ timeout: 15_000 });

    await drawOnOverlay(page, { x: 40, y: 40 }, { x: 160, y: 120 });
    await dialog.getByLabel(/Tell us what you'd suggest/i).fill(SAMPLE_COMMENT);

    const feedbackRequest = page.waitForRequest(
      (req) => req.url().endsWith("/api/feedback") && req.method() === "POST",
      { timeout: 15_000 },
    );
    const feedbackResponse = page.waitForResponse(
      (res) => res.url().endsWith("/api/feedback") && res.request().method() === "POST",
      { timeout: 15_000 },
    );
    await dialog.getByRole("button", { name: /^Submit$/ }).click();

    const req = await feedbackRequest;
    const body = req.postDataJSON() as Record<string, unknown>;
    expect(body).not.toHaveProperty("accessToken");
    expect(body).not.toHaveProperty("token");
    expect(JSON.stringify(body)).not.toContain("FEEDBACK_GITHUB_TOKEN");

    const res = await feedbackResponse;
    const json = (await res.json()) as { ok: boolean; issueUrl?: string; error?: string };
    expect(res.ok(), `feedback POST failed: ${JSON.stringify(json)}`).toBe(true);
    expect(json.ok).toBe(true);
    expect(json.issueUrl ?? "").not.toContain("MOCK-");
    // MSW echoes the Bearer it received as ?auth= on the issue URL — proves
    // the route forwarded the session token, not the bot PAT.
    const url = new URL(json.issueUrl ?? "");
    expect(url.searchParams.get("auth")).toBe("Bearer dev-token");
  });

  test("credentials session submits via the bot fallback path", async ({ page }) => {
    await loginAs(page, "researcher");
    await page.goto("/home");
    const suggestion = page.getByRole("button", { name: /^Suggestion mode$/i });
    await expect(suggestion).toBeVisible();
    await expect(suggestion).toBeEnabled();

    const dialog = await openFeedbackPanel(page);
    const screenshot = dialog.getByRole("img", { name: /Captured screen/i });
    await expect(screenshot).toBeVisible({ timeout: 15_000 });
    await dialog.getByLabel(/Tell us what you'd suggest/i).fill(SAMPLE_COMMENT);

    const feedbackResponse = page.waitForResponse(
      (res) => res.url().endsWith("/api/feedback") && res.request().method() === "POST",
      { timeout: 15_000 },
    );
    await dialog.getByRole("button", { name: /^Submit$/ }).click();
    const res = await feedbackResponse;
    expect(res.ok()).toBe(true);
  });
});
