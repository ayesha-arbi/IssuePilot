import fs from "fs";
import path from "path";
import crypto from "crypto";
import { withGitHubRetry } from "../utils/github.js";
import type { RelevantFile } from "./types.js";

export interface CodeSearchOptions {
  query: string;
  path?: string;
  extension?: string;
  language?: string;
  filename?: string;
}

const memoryCache = new Map<string, RelevantFile[]>();

function getCacheDir(): string {
  const dir = path.resolve(process.cwd(), ".cache", "code-search");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getCacheKey(owner: string, repo: string, q: string): string {
  return crypto.createHash("md5").update(`${owner}/${repo}:${q}`).digest("hex");
}

function rankFiles(items: Array<{ path: string }>, queryTerms: string[]): RelevantFile[] {
  const scored = items.map((item) => {
    let score = 0;
    const lowerPath = item.path.toLowerCase();
    const basename = path.basename(lowerPath);

    for (const term of queryTerms) {
      const lowerTerm = term.toLowerCase();
      if (basename.includes(lowerTerm)) {
        score += 10;
      }
      if (lowerPath.includes(lowerTerm)) {
        score += 5;
      }
    }

    // Depth penalty/bonus: shallower src/lib files get slight bonus
    const depth = item.path.split("/").length;
    score += Math.max(0, 5 - depth);

    // Noisy path penalties
    if (lowerPath.includes("/node_modules/") || lowerPath.includes("/vendor/")) {
      score -= 10;
    }
    if (lowerPath.includes("/__tests__/") || lowerPath.includes("/tests/")) {
      score -= 3;
    }

    return { path: item.path, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 8).map((s) => ({
    path: s.path,
    reason: `Ranked result matching "${queryTerms.join(" ")}"`,
  }));
}

/**
 * Searches code in a repo with support for qualifiers (path, extension, language, filename),
 * ranking, local disk/memory caching, and rate limit retries.
 */
export async function searchCodebase(
  owner: string,
  repo: string,
  optionsOrQuery: string | CodeSearchOptions
): Promise<RelevantFile[]> {
  const options: CodeSearchOptions =
    typeof optionsOrQuery === "string" ? { query: optionsOrQuery } : optionsOrQuery;

  const queryTerms = options.query.split(/\s+/).filter(Boolean);

  let q = `${options.query} repo:${owner}/${repo}`;
  if (options.path) q += ` path:${options.path}`;
  if (options.extension) q += ` extension:${options.extension}`;
  if (options.language) q += ` language:${options.language}`;
  if (options.filename) q += ` filename:${options.filename}`;

  const cacheKey = getCacheKey(owner, repo, q);

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  const cacheFile = path.join(getCacheDir(), `${cacheKey}.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      const raw = fs.readFileSync(cacheFile, "utf-8");
      const cached = JSON.parse(raw) as RelevantFile[];
      memoryCache.set(cacheKey, cached);
      return cached;
    } catch {
      // ignore parse error, re-fetch
    }
  }

  try {
    const rawItems = await withGitHubRetry(async (octokit) => {
      const { data } = await octokit.search.code({
        q,
        per_page: 20,
      });
      return data.items;
    });

    const ranked = rankFiles(rawItems, queryTerms);
    memoryCache.set(cacheKey, ranked);

    try {
      fs.writeFileSync(cacheFile, JSON.stringify(ranked, null, 2), "utf-8");
    } catch {
      // cache write failure non-fatal
    }

    return ranked;
  } catch {
    // code search rate limit or error — return empty fallback
    return [];
  }
}
