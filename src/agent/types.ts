export interface IssueData {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  labels: string[];
  comments: string[];
  url: string;
  contributingGuidelines?: string;
}

export interface RelevantFile {
  path: string;
  reason: string;
  snippet?: string;
}

export interface RelatedHistoryItem {
  type: "pr" | "issue" | "commit";
  title: string;
  url: string;
  summary: string;
}

export interface StarterBrief {
  summary: string;
  likelyCause: string;
  relevantFiles: RelevantFile[];
  relatedHistory: RelatedHistoryItem[];
  difficulty: "easy" | "medium" | "hard";
  difficultyReason: string;
  suggestedFirstStep: string;
}
