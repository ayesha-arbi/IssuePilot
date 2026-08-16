import type { StarterBrief, RelevantFile } from "./types.js";

export interface ValidationResult {
  valid: boolean;
  data?: Omit<StarterBrief, "relatedHistory">;
  error?: string;
}

export function validateSubmitBrief(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, error: "Input must be a JSON object" };
  }

  const obj = input as Record<string, unknown>;

  if (typeof obj.summary !== "string" || !obj.summary.trim()) {
    return { valid: false, error: "Field 'summary' must be a non-empty string." };
  }

  if (typeof obj.likelyCause !== "string" || !obj.likelyCause.trim()) {
    return { valid: false, error: "Field 'likelyCause' must be a non-empty string." };
  }

  if (!Array.isArray(obj.relevantFiles)) {
    return { valid: false, error: "Field 'relevantFiles' must be an array." };
  }

  const validFiles: RelevantFile[] = [];
  for (let i = 0; i < obj.relevantFiles.length; i++) {
    const item = obj.relevantFiles[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { valid: false, error: `relevantFiles[${i}] must be an object with 'path' and 'reason'.` };
    }
    const fileObj = item as Record<string, unknown>;
    if (typeof fileObj.path !== "string" || !fileObj.path.trim()) {
      return { valid: false, error: `relevantFiles[${i}].path must be a non-empty string.` };
    }
    if (typeof fileObj.reason !== "string" || !fileObj.reason.trim()) {
      return { valid: false, error: `relevantFiles[${i}].reason must be a non-empty string.` };
    }
    validFiles.push({
      path: fileObj.path.trim(),
      reason: fileObj.reason.trim(),
      snippet: typeof fileObj.snippet === "string" ? fileObj.snippet : undefined,
    });
  }

  const allowedDifficulties = ["easy", "medium", "hard"];
  if (typeof obj.difficulty !== "string" || !allowedDifficulties.includes(obj.difficulty.toLowerCase())) {
    return { valid: false, error: "Field 'difficulty' must be one of: 'easy', 'medium', 'hard'." };
  }

  if (typeof obj.difficultyReason !== "string" || !obj.difficultyReason.trim()) {
    return { valid: false, error: "Field 'difficultyReason' must be a non-empty string." };
  }

  if (typeof obj.suggestedFirstStep !== "string" || !obj.suggestedFirstStep.trim()) {
    return { valid: false, error: "Field 'suggestedFirstStep' must be a non-empty string." };
  }

  return {
    valid: true,
    data: {
      summary: obj.summary.trim(),
      likelyCause: obj.likelyCause.trim(),
      relevantFiles: validFiles,
      difficulty: obj.difficulty.toLowerCase() as "easy" | "medium" | "hard",
      difficultyReason: obj.difficultyReason.trim(),
      suggestedFirstStep: obj.suggestedFirstStep.trim(),
    },
  };
}
