import { getFallbackModels, createModelClient, llm, type ModelConfig } from "../utils/llm.js";
import { TOOLS, executeTool } from "./tools.js";
import { validateSubmitBrief } from "./validator.js";
import { TranscriptLogger } from "./transcript.js";
import { globalSpinner } from "../utils/spinner.js";
import type { IssueData, RelatedHistoryItem, StarterBrief } from "./types.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const SYSTEM_PROMPT = `You help first-time open source contributors understand a GitHub issue
before they start coding. You have tools to search the codebase, read specific files, and search
past PR history. Investigate as much as you need to — for a vague issue, search and read more; for
a clear issue, you may need very little. When you have enough to confidently guide a newcomer,
call submit_brief to finish. Do not call submit_brief until you've made at least one search.

When you decide to call a tool, output ONLY the tool call. Do not write any conversational responses, thoughts, or explanations before or after the tool call.`;

export interface AgentLoopOptions {
  maxTurns?: number;
  fallbackModels?: string;
}

export async function runAgent(issue: IssueData, options: AgentLoopOptions = {}): Promise<StarterBrief> {
  const maxTurns = options.maxTurns || (process.env.MAX_TURNS ? parseInt(process.env.MAX_TURNS, 10) : 15);
  const fallbackModelSpecs = getFallbackModels(options.fallbackModels);

  const logger = new TranscriptLogger(issue.owner, issue.repo, issue.number);
  const ctx = { owner: issue.owner, repo: issue.repo };

  let userPrompt = `Issue #${issue.number}: ${issue.title}\nURL: ${issue.url}\nLabels: ${issue.labels.join(", ") || "none"}\n\nBody:\n${issue.body || "(no description)"}`;
  if (issue.contributingGuidelines) {
    userPrompt += `\n\nRepo Contributing Guidelines Excerpt:\n${issue.contributingGuidelines}`;
  }
  if (issue.comments.length) {
    userPrompt += `\n\nTop issue comments:\n${issue.comments
      .slice(0, 5)
      .map((c, i) => `${i + 1}. ${c.substring(0, 200)}`)
      .join("\n")}`;
  }

  const baseMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  logger.logStep({
    turn: 0,
    model: "system",
    role: "system",
    content: SYSTEM_PROMPT,
  });

  let currentModelIndex = 0;
  let modelAttempts = 0;

  while (currentModelIndex < fallbackModelSpecs.length) {
    const spec = fallbackModelSpecs[currentModelIndex];
    let modelConfig: ModelConfig;

    try {
      modelConfig = createModelClient(spec);
    } catch {
      currentModelIndex++;
      continue;
    }

    const messages: ChatCompletionMessageParam[] = [...baseMessages];
    let rePromptedValidation = false;
    let hasExecutedSearchTool = false;
    let relatedHistory: RelatedHistoryItem[] = [];

    globalSpinner.update(`Running agent with model: ${spec}...`);

    try {
      for (let turn = 0; turn < maxTurns; turn++) {
        if (turn >= 10) {
          globalSpinner.update(`[Warning] High turn count (${turn + 1}/${maxTurns}) with model ${spec}...`);
        } else {
          globalSpinner.update(`Investigating issue with ${spec} (turn ${turn + 1}/${maxTurns})...`);
        }

        // Require tool call on turn 0 to prevent plain text chatter
        const toolChoiceParam = turn === 0 ? "required" : "auto";

        const response = await llm.callLlmWithRetry(modelConfig, {
          max_tokens: 2000,
          temperature: 0.0,
          tools: TOOLS,
          tool_choice: toolChoiceParam,
          messages,
        });

        const message = response.choices[0]?.message;
        if (!message) {
          throw new Error("Empty completion response from model");
        }

        messages.push(message);

        const toolCalls = message.tool_calls ?? [];

        logger.logStep({
          turn: turn + 1,
          model: spec,
          role: message.role,
          content: message.content,
          toolCalls: toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          })),
        });

        // Check for submit_brief
        const submitCall = toolCalls.find((c) => c.function.name === "submit_brief");
        if (submitCall) {
          // CODE-LEVEL GUARDRAIL: Reject submit_brief if no prior search tool executed
          if (!hasExecutedSearchTool) {
            const prematureErrorMsg = "INVALID SUBMIT_BRIEF: You cannot call submit_brief without performing at least one search. You MUST call search_codebase or search_history first to locate relevant files in the repository.";
            messages.push({
              role: "user",
              content: prematureErrorMsg,
            });
            logger.logStep({
              turn: turn + 1,
              model: spec,
              role: "user",
              content: prematureErrorMsg,
            });
            globalSpinner.update(`[Guardrail] Rejected premature submit_brief on turn ${turn + 1}. Forcing tool search...`);
            continue;
          }

          let parsedInput: unknown;
          try {
            parsedInput = JSON.parse(submitCall.function.arguments);
          } catch {
            parsedInput = null;
          }

          const validation = validateSubmitBrief(parsedInput);
          if (validation.valid && validation.data) {
            const brief: StarterBrief = {
              ...validation.data,
              relatedHistory: [...relatedHistory],
            };
            const transcriptPath = logger.save("success", brief);
            globalSpinner.succeed(`Brief successfully generated! Transcript saved to ${transcriptPath}`);
            return brief;
          }

          // Validation failed
          if (!rePromptedValidation) {
            rePromptedValidation = true;
            const errMsg = `The submit_brief arguments were invalid: ${validation.error || "Malformed JSON"}. Please correct the parameters and call submit_brief again.`;
            messages.push({
              role: "user",
              content: errMsg,
            });
            logger.logStep({
              turn: turn + 1,
              model: spec,
              role: "user",
              content: errMsg,
            });
            continue;
          } else {
            // Second validation failure for this model
            throw new Error(`Model ${spec} failed submit_brief schema validation twice.`);
          }
        }

        if (toolCalls.length === 0) {
          messages.push({
            role: "user",
            content: "Please investigate using your tools (search_codebase, read_file, search_history) before submitting.",
          });
          continue;
        }

        // Execute tool calls
        for (const call of toolCalls) {
          globalSpinner.update(`Executing tool ${call.function.name}...`);
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(call.function.arguments);
          } catch {
            input = {};
          }

          const result = await executeTool(call.function.name, input, ctx);

          // Track search tool execution
          if (call.function.name === "search_codebase" || call.function.name === "search_history") {
            hasExecutedSearchTool = true;
          }
          if (call.function.name === "search_history") {
            const searchResults = result as RelatedHistoryItem[];
            relatedHistory = [...relatedHistory, ...searchResults];
          }

          logger.logStep({
            turn: turn + 1,
            model: spec,
            role: "tool",
            toolResult: {
              toolName: call.function.name,
              input,
              output: result,
            },
          });

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
      }

      throw new Error(`Model ${spec} reached max turns (${maxTurns}) without completing brief.`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.logStep({
        turn: -1,
        model: spec,
        role: "error",
        error: errMsg,
      });

      // Skip retries immediately for auth/key failures — no point retrying with the same bad key
      const isAuthFailure =
        (err as { status?: number }).status === 401 ||
        (err as { status?: number }).status === 403 ||
        /Invalid API Key|API key not valid|INVALID_ARGUMENT/i.test(errMsg);

      modelAttempts++;
      if (!isAuthFailure && modelAttempts < 2) {
        globalSpinner.update(`Retrying model ${spec} (attempt ${modelAttempts + 1}/2)...`);
        continue;
      }

      // Move to next fallback model
      currentModelIndex++;
      modelAttempts = 0;
      if (currentModelIndex < fallbackModelSpecs.length) {
        globalSpinner.update(`Model ${spec} failed (${errMsg}). Retrying with ${fallbackModelSpecs[currentModelIndex]}...`);
      }
    }
  }

  const errMessage = `Agent failed to generate brief across all fallback models (${fallbackModelSpecs.join(", ")}).`;
  const savedTranscriptPath = logger.save("failure", errMessage);
  globalSpinner.fail(`Agent execution failed.`);
  throw new Error(`${errMessage} Full transcript saved at: ${savedTranscriptPath}`);
}
