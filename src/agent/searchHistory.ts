import { withGitHubRetry } from "../utils/github.js";
import type { RelatedHistoryItem } from "./types.js";

/**
 * Searches past PRs/issues in a repo for a given query using octokit.request('GET /search/issues').
 */
export async function searchHistory(owner: string, repo: string, query: string): Promise<RelatedHistoryItem[]> {
  const results: RelatedHistoryItem[] = [];

  try {
    const data = await withGitHubRetry(async (octokit) => {
      const response = await octokit.request("GET /search/issues", {
        q: `${query} repo:${owner}/${repo} is:pr`,
        per_page: 5,
      });
      return response.data;
    });

    for (const item of data.items) {
      results.push({
        type: "pr",
        title: item.title,
        url: item.html_url,
        summary: item.state === "closed" ? "Closed PR — check why before repeating the approach" : "Open PR — may already be in progress",
      });
    }
  } catch {
    // non-fatal — history is a nice-to-have, not a blocker
  }

  return results;
}
