import { Octokit } from "@octokit/rest";

let octokitInstance: Octokit | null = null;

export function getOctokit(): Octokit {
  if (!octokitInstance) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is not set. Run 'npx issuepilot init' or add GITHUB_TOKEN to your .env file.");
    }
    octokitInstance = new Octokit({ auth: token });
  }
  return octokitInstance;
}

/** Reset instance if needed for testing */
export function resetOctokitInstance(): void {
  octokitInstance = null;
}

/**
 * Wraps an Octokit API call with retry & exponential backoff on 403/429 rate limits.
 */
export async function withGitHubRetry<T>(fn: (octokit: Octokit) => Promise<T>, maxRetries = 3): Promise<T> {
  const octokit = getOctokit();
  let attempt = 0;

  while (true) {
    try {
      return await fn(octokit);
    } catch (err: unknown) {
      attempt++;
      const status = (err as { status?: number })?.status;
      const isRateLimit = status === 403 || status === 429;

      if (isRateLimit && attempt <= maxRetries) {
        const headers = (err as { response?: { headers?: Record<string, string> } })?.response?.headers;
        const resetHeader = headers?.["x-ratelimit-reset"];
        const retryAfterHeader = headers?.["retry-after"];

        let delayMs = Math.pow(2, attempt) * 1000;

        if (resetHeader) {
          const resetEpoch = parseInt(resetHeader, 10);
          if (!isNaN(resetEpoch)) {
            const nowSeconds = Math.floor(Date.now() / 1000);
            const diffSeconds = resetEpoch - nowSeconds;
            if (diffSeconds > 0 && diffSeconds <= 15) {
              delayMs = diffSeconds * 1000;
            }
          }
        } else if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 15) {
            delayMs = parsed * 1000;
          }
        }

        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
}

/** Reads a file's text content from a repo with optional line-range slicing. */
export async function getFileContents(
  owner: string,
  repo: string,
  path: string,
  startLine?: number,
  endLine?: number
): Promise<string> {
  return withGitHubRetry(async (octokit) => {
    const { data } = await octokit.repos.getContent({ owner, repo, path });

    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      throw new Error(`${path} is not a readable file`);
    }

    const rawContent = Buffer.from(data.content, "base64").toString("utf-8");

    if (startLine || endLine) {
      const lines = rawContent.split("\n");
      const s = Math.max(1, startLine || 1);
      const e = Math.min(lines.length, endLine || lines.length);
      const sliced = lines.slice(s - 1, e).map((line, idx) => `${s + idx}: ${line}`);
      return sliced.join("\n");
    }

    return rawContent;
  });
}

/** Parses "https://github.com/owner/repo/issues/123" into its parts. */
export function parseIssueUrl(url: string): { owner: string; repo: string; number: number } {
  if (!url || typeof url !== "string") {
    throw new Error(`Could not parse issue URL: ${url}`);
  }
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!match) {
    throw new Error(`Could not parse issue URL: ${url}`);
  }
  const [, owner, repo, numberStr] = match;
  return { owner, repo, number: parseInt(numberStr, 10) };
}
