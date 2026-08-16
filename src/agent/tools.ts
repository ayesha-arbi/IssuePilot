import { searchCodebase, type CodeSearchOptions } from "./exploreCodebase.js";
import { searchHistory } from "./searchHistory.js";
import { getFileContents } from "../utils/github.js";

export const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_codebase",
      description:
        "Search the repo's code for a keyword or phrase. Use optional qualifiers (path, extension, language, filename) to narrow search scope on large repos.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Keyword or short phrase to search for in the codebase" },
          path: { type: "string", description: "Optional subpath to restrict search, e.g. 'src/components'" },
          extension: { type: "string", description: "Optional file extension filter without leading dot, e.g. 'ts' or 'py'" },
          language: { type: "string", description: "Optional programming language filter, e.g. 'typescript'" },
          filename: { type: "string", description: "Optional filename or partial filename filter, e.g. 'authController'" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description:
        "Read the contents of a specific file in the repo. Use optional startLine and endLine to inspect targeted code ranges in large files.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path in the repo, e.g. src/utils/auth.ts" },
          startLine: { type: "integer", description: "Optional 1-indexed starting line number" },
          endLine: { type: "integer", description: "Optional 1-indexed ending line number" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_history",
      description:
        "Search past pull requests in the repo for prior attempts at fixing something similar. Use this to check if someone already tried this and what happened.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Keyword or short phrase to search for in past PR titles" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "submit_brief",
      description:
        "Call this ONLY when you have enough information to write the final starter brief. This ends the investigation.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "2-3 sentences, plain language, what the issue is actually asking for" },
          likelyCause: { type: "string", description: "Your best guess at the root cause" },
          relevantFiles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string", description: "File path in the repository" },
                reason: { type: "string", description: "Why this file is relevant" },
                snippet: { type: "string", description: "2-5 lines code snippet from the file showing the relevant function/logic" },
              },
              required: ["path", "reason"],
            },
          },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          difficultyReason: { type: "string" },
          suggestedFirstStep: { type: "string", description: "One concrete, actionable first step" },
        },
        required: ["summary", "likelyCause", "relevantFiles", "difficulty", "difficultyReason", "suggestedFirstStep"],
      },
    },
  },
];

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { owner: string; repo: string }
): Promise<unknown> {
  switch (name) {
    case "search_codebase": {
      const searchOpts: CodeSearchOptions = {
        query: (input.query as string) || "",
        path: input.path as string | undefined,
        extension: input.extension as string | undefined,
        language: input.language as string | undefined,
        filename: input.filename as string | undefined,
      };
      return searchCodebase(ctx.owner, ctx.repo, searchOpts);
    }
    case "read_file":
      try {
        const filePath = (input.path as string) || "";
        const startLine = typeof input.startLine === "number" ? input.startLine : undefined;
        const endLine = typeof input.endLine === "number" ? input.endLine : undefined;
        const content = await getFileContents(ctx.owner, ctx.repo, filePath, startLine, endLine);
        return content.slice(0, 5000);
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    case "search_history":
      return searchHistory(ctx.owner, ctx.repo, (input.query as string) || "");
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
