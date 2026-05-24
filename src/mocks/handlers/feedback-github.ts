import { http, HttpResponse } from "msw";

let issueCounter = 1000;

export const feedbackGithubHandlers = [
  http.put(
    "https://api.github.com/repos/:owner/:repo/contents/.github/feedback-images/:filename",
    async ({ params }) => {
      const { owner, repo, filename } = params as {
        owner: string;
        repo: string;
        filename: string;
      };
      const downloadUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/.github/feedback-images/${filename}`;
      return HttpResponse.json(
        {
          content: {
            name: filename,
            path: `.github/feedback-images/${filename}`,
            sha: `mock-sha-${filename}`,
            download_url: downloadUrl,
          },
          commit: { sha: `mock-commit-${filename}` },
        },
        { status: 201 },
      );
    },
  ),
  http.post("https://api.github.com/repos/:owner/:repo/issues", async ({ params, request }) => {
    const { owner, repo } = params as { owner: string; repo: string };
    const auth = request.headers.get("authorization");
    const number = ++issueCounter;
    // Echo the auth fingerprint back so parallel e2e tests can attribute a
    // request to its caller without sharing global state.
    const fp = auth ? `?auth=${encodeURIComponent(auth)}` : "";
    return HttpResponse.json(
      {
        number,
        html_url: `https://github.com/${owner}/${repo}/issues/${number}${fp}`,
        title: "mock",
      },
      { status: 201 },
    );
  }),
  http.get("https://api.github.com/user", () =>
    HttpResponse.json({ login: "octocat-test", id: 1 }, { status: 200 }),
  ),
];
