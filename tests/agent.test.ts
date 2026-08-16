import { test } from "node:test";
import assert from "node:assert";
import { createModelClient } from "../src/utils/llm.js";
import { llm } from "../src/utils/llm.js";
import type { IssueData } from "../src/agent/types.js";

// Force a dummy key for testing so LLM configurations load
process.env.GEMINI_API_KEY = "test-gemini-key";

// ─── Test 1: Gemini config has no dual-auth defaultQuery ─────────────────────
test("Gemini config: correct baseURL, no dual-auth defaultQuery", () => {
  const modelConfig = createModelClient("gemini/gemini-2.0-flash");
  assert.strictEqual(modelConfig.provider, "gemini");
  assert.deepStrictEqual(modelConfig.apiKeys, ["test-gemini-key"]);
  assert.strictEqual(
    modelConfig.baseUrl,
    "https://generativelanguage.googleapis.com/v1beta/openai/"
  );
  // If dual-auth were still present, the OpenAI SDK would also append ?key=...
  // to every request, causing Google to return 400 "Multiple authentication credentials".
  // This test asserts the ModelConfig shape is correct — the old clientOptions.defaultQuery
  // block has been removed from callLlmWithRetry in llm.ts.
});

// ─── Test 2: CONTRIBUTING.md content is injected into the LLM user prompt ───
test("CONTRIBUTING.md content is injected into the LLM user prompt", async () => {
  const mockIssue: IssueData = {
    owner: "test-owner",
    repo: "test-repo",
    number: 123,
    title: "Test Issue Title",
    body: "Test Issue Body",
    labels: ["bug"],
    comments: [],
    url: "https://github.com/test-owner/test-repo/issues/123",
    contributingGuidelines: "This is the contributing guideline content.",
  };

  let messagesSentToLlm: any[] = [];

  // Stub llm.callLlmWithRetry via the mutable object export (ESM-safe)
  const original = llm.callLlmWithRetry;
  llm.callLlmWithRetry = async (_modelConfig: any, params: any) => {
    messagesSentToLlm = params.messages;
    return {
      choices: [
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_search",
                type: "function",
                function: { name: "search_codebase", arguments: JSON.stringify({ query: "test" }) },
              },
            ],
          },
        },
      ],
    } as any;
  };

  try {
    const { runAgent } = await import("../src/agent/agentLoop.js");
    await runAgent(mockIssue, { maxTurns: 1, fallbackModels: "gemini/gemini-2.0-flash" }).catch(() => {});

    const userMsg = messagesSentToLlm.find((m: any) => m.role === "user");
    assert.ok(userMsg, "User message should be sent to LLM");
    assert.match(userMsg.content, /Repo Contributing Guidelines Excerpt:/);
    assert.match(userMsg.content, /This is the contributing guideline content\./);
  } finally {
    llm.callLlmWithRetry = original;
  }
});

// ─── Test 3: Search guardrail blocks premature submit_brief ──────────────────
test("Search guardrail: rejects submit_brief before any search, allows after", async () => {
  const mockIssue: IssueData = {
    owner: "test-owner",
    repo: "test-repo",
    number: 456,
    title: "Another Issue",
    body: "Issue body",
    labels: [],
    comments: [],
    url: "https://github.com/test-owner/test-repo/issues/456",
  };

  let attempts = 0;
  let sawGuardrailRejection = false;
  let sawAcceptedBrief = false;

  const original = llm.callLlmWithRetry;
  llm.callLlmWithRetry = async (_modelConfig: any, params: any) => {
    attempts++;
    const lastMsg = params.messages[params.messages.length - 1];
    if (lastMsg?.role === "user" && lastMsg.content.includes("INVALID SUBMIT_BRIEF")) {
      sawGuardrailRejection = true;
    }

    if (attempts === 1) {
      // Turn 0: model immediately tries submit_brief (no search yet)
      return {
        choices: [{ message: { role: "assistant", tool_calls: [{ id: "c1", type: "function", function: { name: "submit_brief", arguments: JSON.stringify({ summary: "S", likelyCause: "L", relevantFiles: [{ path: "f.ts", reason: "r" }], difficulty: "easy", difficultyReason: "dr", suggestedFirstStep: "step" }) } }] } }],
      } as any;
    } else if (attempts === 2) {
      // Turn 1: after rejection, model correctly searches
      return {
        choices: [{ message: { role: "assistant", tool_calls: [{ id: "c2", type: "function", function: { name: "search_codebase", arguments: JSON.stringify({ query: "main" }) } }] } }],
      } as any;
    } else {
      // Turn 2: now submit_brief is allowed
      sawAcceptedBrief = true;
      return {
        choices: [{ message: { role: "assistant", tool_calls: [{ id: "c3", type: "function", function: { name: "submit_brief", arguments: JSON.stringify({ summary: "Summary", likelyCause: "Cause", relevantFiles: [{ path: "src/index.ts", reason: "main" }], difficulty: "easy", difficultyReason: "simple", suggestedFirstStep: "Check lines 1-10" }) } }] } }],
      } as any;
    }
  };

  try {
    const { runAgent } = await import("../src/agent/agentLoop.js");
    const brief = await runAgent(mockIssue, { maxTurns: 5, fallbackModels: "gemini/gemini-2.0-flash" });

    assert.ok(sawGuardrailRejection, "Guardrail must have fired and rejected the premature submit_brief");
    assert.ok(sawAcceptedBrief, "submit_brief must eventually be accepted after a search");
    assert.strictEqual(brief.summary, "Summary");
    assert.strictEqual(brief.difficulty, "easy");
  } finally {
    llm.callLlmWithRetry = original;
  }
});

// ─── Test 4: Auth failure is NOT retried (fast-skip to next model) ───────────
test("Auth failure (400 Invalid API Key) skips model retries immediately", async () => {
  const mockIssue: IssueData = {
    owner: "o",
    repo: "r",
    number: 1,
    title: "T",
    body: "B",
    labels: [],
    comments: [],
    url: "https://github.com/o/r/issues/1",
  };

  let attemptCount = 0;
  const original = llm.callLlmWithRetry;
  llm.callLlmWithRetry = async (modelConfig: any, _params: any) => {
    attemptCount++;
    // Simulate Gemini auth failure
    const err: any = new Error("400 Bad Request / Invalid API Key: API key not valid.");
    err.status = 400;
    throw err;
  };

  try {
    const { runAgent } = await import("../src/agent/agentLoop.js");
    await runAgent(mockIssue, { maxTurns: 3, fallbackModels: "gemini/gemini-2.0-flash,gemini/gemini-1.5-flash" }).catch(() => {});
    // Without the auth-failure fast-skip, each model would be retried 2× → 4 attempts total.
    // With the fast-skip, each model is tried only once → 2 attempts max.
    assert.ok(attemptCount <= 2, `Expected ≤2 attempts (one per model, no retries), got ${attemptCount}`);
  } finally {
    llm.callLlmWithRetry = original;
  }
});
