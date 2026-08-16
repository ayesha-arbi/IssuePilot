import fs from "fs";
import path from "path";

export interface TranscriptStep {
  turn: number;
  model: string;
  timestamp: string;
  role: string;
  content?: string | null;
  toolCalls?: unknown[];
  toolResult?: {
    toolName: string;
    input: unknown;
    output: unknown;
  };
  error?: string;
}

export class TranscriptLogger {
  private repoKey: string;
  private issueNumber: number;
  private steps: TranscriptStep[] = [];
  private startTime: string;

  constructor(owner: string, repo: string, issueNumber: number) {
    this.repoKey = `${owner}-${repo}`;
    this.issueNumber = issueNumber;
    this.startTime = new Date().toISOString().replace(/[:.]/g, "-");
  }

  public logStep(step: Omit<TranscriptStep, "timestamp">): void {
    this.steps.push({
      ...step,
      timestamp: new Date().toISOString(),
    });
  }

  public save(status: "success" | "failure", finalDataOrError?: unknown): string {
    const runsDir = path.resolve(process.cwd(), "runs");
    if (!fs.existsSync(runsDir)) {
      fs.mkdirSync(runsDir, { recursive: true });
    }
    const filename = `${this.repoKey}-${this.issueNumber}-${this.startTime}.json`;
    const filePath = path.join(runsDir, filename);

    const data = {
      repoKey: this.repoKey,
      issueNumber: this.issueNumber,
      status,
      startTime: this.startTime,
      endTime: new Date().toISOString(),
      resultOrError: finalDataOrError,
      steps: this.steps,
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return filePath;
  }
}
