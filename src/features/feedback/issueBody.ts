import type { ComponentOutline, FeedbackContext, Shape } from "./types";

export function issueTitle(comment: string): string {
  const single = comment.replace(/\s+/g, " ").trim();
  const truncated = single.length > 80 ? `${single.slice(0, 80)}…` : single;
  return `Suggestion: ${truncated}`;
}

export type IssueBodyInput = {
  comment: string;
  imageRawUrl?: string;
  annotations?: {
    schemaVersion: 1;
    imageWidth: number;
    imageHeight: number;
    shapes: Shape[];
  };
  context: FeedbackContext;
  githubLogin?: string;
};

function formatOutline(outline: ComponentOutline): string {
  const lines: string[] = [];
  if (outline.pageTitle) lines.push(`Page: ${outline.pageTitle}`);
  for (const h of outline.headings) {
    lines.push(`H${h.level}: ${h.text}`);
  }
  if (outline.navActive) {
    const siblings = outline.navSiblings.filter((s) => s.length > 0);
    const siblingsPart = siblings.length > 0 ? `   Nav-siblings: ${siblings.join(" · ")}` : "";
    lines.push(`Nav-active: ${outline.navActive}${siblingsPart}`);
  } else if (outline.navSiblings.length > 0) {
    lines.push(`Nav-siblings: ${outline.navSiblings.join(" · ")}`);
  }
  if (outline.primaryButtons.length > 0) {
    lines.push(`Buttons: ${outline.primaryButtons.join(" · ")}`);
  }
  if (outline.slots.length > 0) {
    lines.push(`Slots: ${outline.slots.join(", ")}`);
  }
  if (lines.length === 0) return "(no structural snapshot captured)";
  return lines.join("\n");
}

function formatReporter(ctx: FeedbackContext, githubLogin?: string): string {
  const emailLink = `[${ctx.reporterEmail}](mailto:${ctx.reporterEmail})`;
  if (githubLogin) {
    const handleLink = `[@${githubLogin}](https://github.com/${githubLogin})`;
    return `${handleLink} (${emailLink})`;
  }
  return emailLink;
}

function formatContextTable(ctx: FeedbackContext, githubLogin?: string): string {
  return [
    "| | |",
    "|---|---|",
    `| Route | \`${ctx.route}\` |`,
    `| Persona | \`${ctx.persona}\` |`,
    `| Reporter | ${formatReporter(ctx, githubLogin)} |`,
    `| Viewport | ${ctx.viewport.w} × ${ctx.viewport.h} |`,
    `| Build | \`${ctx.buildSha}\` |`,
    `| Time | ${ctx.timestamp} |`,
    `| User-Agent | \`${ctx.userAgent}\` |`,
  ].join("\n");
}

function outlineDetailsBlock(outline: ComponentOutline): string {
  return [
    "<details><summary>Component outline (auto-captured)</summary>",
    "",
    "```",
    formatOutline(outline),
    "```",
    "",
    "</details>",
  ].join("\n");
}

function annotationsDetailsBlock(annotations: NonNullable<IssueBodyInput["annotations"]>): string {
  return [
    "<details><summary>Annotation metadata</summary>",
    "",
    "```json",
    JSON.stringify(annotations, null, 2),
    "```",
    "",
    "</details>",
  ].join("\n");
}

function consoleErrorsBlock(errors: string[]): string {
  if (errors.length === 0) return "";
  return [
    "<details><summary>Recent client console errors (last 10)</summary>",
    "",
    "```",
    errors.join("\n"),
    "```",
    "",
    "</details>",
  ].join("\n");
}

export function issueBody(input: IssueBodyInput): string {
  const { comment, imageRawUrl, annotations, context, githubLogin } = input;
  const parts: string[] = [];

  if (imageRawUrl) {
    parts.push(`![annotated suggestion](${imageRawUrl})`);
    parts.push("## Suggestion");
    parts.push(comment);
    parts.push("## Context");
    parts.push(formatContextTable(context, githubLogin));
    parts.push(outlineDetailsBlock(context.componentOutline));
    if (annotations) parts.push(annotationsDetailsBlock(annotations));
  } else {
    parts.push("## Suggestion");
    parts.push(comment);
    parts.push("```");
    parts.push(formatOutline(context.componentOutline));
    parts.push("```");
    parts.push("## Context");
    parts.push(formatContextTable(context, githubLogin));
  }

  const consoleBlock = consoleErrorsBlock(context.consoleErrors);
  if (consoleBlock) parts.push(consoleBlock);

  parts.push("— filed via Nexus Portal feedback widget");
  return parts.join("\n\n");
}
