import { withGitHubRetry } from "../utils/github.js";
import type { IssueData } from "./types.js";

async function fetchRepoGuidelines(octokit: any, owner: string, repo: string): Promise<string | undefined> {
  const candidatePaths = ["CONTRIBUTING.md", ".github/CONTRIBUTING.md", "docs/CONTRIBUTING.md"];

  for (const path of candidatePaths) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path });
      if (!Array.isArray(data) && data.type === "file" && "content" in data) {
        const text = Buffer.from(data.content, "base64").toString("utf-8");
        return text.slice(0, 1500); // Excerpt
      }
    } catch {
      // try next candidate
    }
  }

  return undefined;
}

export async function fetchIssue(owner: string, repo: string, number: number): Promise<IssueData> {
  return withGitHubRetry(async (octokit) => {
    const { data: issue } = await octokit.issues.get({ owner, repo, issue_number: number });

    const { data: commentsData } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: number,
      per_page: 20,
    });

    const guidelines = await fetchRepoGuidelines(octokit, owner, repo);

    return {
      owner,
      repo,
      number,
      title: issue.title,
      body: issue.body ?? "",
      labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")).filter(Boolean),
      comments: commentsData.map((c) => c.body ?? "").filter(Boolean),
      url: issue.html_url,
      contributingGuidelines: guidelines,
    };
  });
}
