import { expect, test, type Page } from "@playwright/test";
import { loginAsGithubUser } from "./fixtures/personas";

const SAMPLE_COMMENT = "This screen needs better spacing for readability."; // > 25 chars

async function openFeedbackPanel(page: Page) {
  await page.getByRole("button", { name: /Suggestion mode/i }).click();
  const dialog = page.getByRole("dialog", { name: /Suggestion mode/i });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

// Drag inside the SVG annotation surface to create a primitive.
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
test.describe.serial("feedback mode (Suggestion mode)", () => {
  test("happy path: capture screenshot, annotate, submit", async ({ page }) => {
    await loginAsGithubUser(page, "researcher");
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /^Projects$/ })).toBeVisible();

    const dialog = await openFeedbackPanel(page);

    // Screenshot may take a moment under Playwright's slow render.
    const screenshot = dialog.getByRole("img", { name: /Captured screen/i });
    await expect(screenshot).toBeVisible({ timeout: 15_000 });

    // Default tool is Rectangle; draw, switch to Arrow, draw, switch to Pen, draw.
    await drawOnOverlay(page, { x: 40, y: 40 }, { x: 160, y: 120 });
    await dialog.getByRole("button", { name: /^Arrow$/ }).click();
    await drawOnOverlay(page, { x: 200, y: 60 }, { x: 320, y: 180 });
    await dialog.getByRole("button", { name: /^Pen$/ }).click();
    await drawOnOverlay(page, { x: 360, y: 40 }, { x: 460, y: 140 });

    // Undo button only enables once a shape exists — proves shapes committed.
    await expect(dialog.getByRole("button", { name: /^Undo$/ })).toBeEnabled();

    await dialog.getByLabel(/Tell us what you'd suggest/i).fill(SAMPLE_COMMENT);
    await dialog.getByRole("button", { name: /^Submit$/ }).click();

    const toastRegion = page.locator("[data-sonner-toaster]");
    await expect(toastRegion.getByText(/Suggestion filed/i)).toBeVisible({ timeout: 15_000 });
    await expect(toastRegion.getByRole("button", { name: /View on GitHub/i })).toBeVisible();

    await expect(dialog).toBeHidden();
  });

  test("text-only path: remove screenshot, submit text + outline", async ({ page }) => {
    await loginAsGithubUser(page, "researcher");
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /^Projects$/ })).toBeVisible();

    const dialog = await openFeedbackPanel(page);
    await expect(dialog.getByRole("img", { name: /Captured screen/i })).toBeVisible({
      timeout: 15_000,
    });

    await dialog
      .getByRole("button", { name: /Remove screenshot from this suggestion/i })
      .click();

    // Toolbar disappears with the screenshot (tool buttons render only when active).
    await expect(dialog.getByRole("button", { name: /^Rectangle$/ })).toHaveCount(0);
    await expect(dialog.getByText(/Screenshot removed/i)).toBeVisible();

    await dialog.getByLabel(/Tell us what you'd suggest/i).fill(SAMPLE_COMMENT);
    await dialog.getByRole("button", { name: /^Submit$/ }).click();

    const toastRegion = page.locator("[data-sonner-toaster]");
    await expect(toastRegion.getByText(/Suggestion filed/i)).toBeVisible({ timeout: 15_000 });
    await expect(toastRegion.getByRole("button", { name: /View on GitHub/i })).toBeVisible();
  });

  test("validation: submit gated by 10-char minimum comment", async ({ page }) => {
    await loginAsGithubUser(page, "researcher");
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /^Projects$/ })).toBeVisible();

    const dialog = await openFeedbackPanel(page);
    const textarea = dialog.getByLabel(/Tell us what you'd suggest/i);
    const submit = dialog.getByRole("button", { name: /^Submit$/ });

    await expect(submit).toBeDisabled();

    await textarea.fill("too short");
    await expect(submit).toBeDisabled();

    await textarea.fill("this is long enough to enable submit");
    await expect(submit).toBeEnabled();
  });

  test("POST payload carries componentOutline.navActive === 'Projects'", async ({ page }) => {
    await loginAsGithubUser(page, "researcher");
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /^Projects$/ })).toBeVisible();

    const dialog = await openFeedbackPanel(page);
    await expect(dialog.getByRole("img", { name: /Captured screen/i })).toBeVisible({
      timeout: 15_000,
    });
    await dialog.getByLabel(/Tell us what you'd suggest/i).fill(SAMPLE_COMMENT);

    const requestPromise = page.waitForRequest(
      (req) => req.url().endsWith("/api/feedback") && req.method() === "POST",
      { timeout: 15_000 },
    );
    await dialog.getByRole("button", { name: /^Submit$/ }).click();
    const request = await requestPromise;

    const body = request.postDataJSON() as {
      context: { componentOutline: { navActive: string } };
    };
    expect(body.context.componentOutline.navActive).toBe("Projects");
  });
});
