import "dotenv/config";
import { getOctokit } from "./utils/github.js";
import { runPipeline, formatBriefAsMarkdown } from "./index.js";

/**
 * Run inside GitHub Actions. Expects these env vars (see workflow yml):
 * GITHUB_REPOSITORY = "owner/repo"
 * ISSUE_NUMBER      = the issue that was just labeled
 */
async function main() {
  const repoFull = process.env.GITHUB_REPOSITORY;
  const issueNumberStr = process.env.ISSUE_NUMBER;

  if (!repoFull || !issueNumberStr) {
    throw new Error("Missing GITHUB_REPOSITORY or ISSUE_NUMBER env vars");
  }

  const [owner, repo] = repoFull.split("/");
  const number = parseInt(issueNumberStr, 10);

  console.log(`Generating starter brief for ${owner}/${repo}#${number}...`);
  const brief = await runPipeline(owner, repo, number);
  const markdown = formatBriefAsMarkdown(brief);

  const octokit = getOctokit();
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: number,
    body: markdown,
  });

  console.log("Posted starter brief comment.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
