export type InputType = "diff" | "files";
export type Provider = "mock" | "deepseek" | "minimax";
export type Intensity = "quick" | "standard";
export type AuditRule =
  | "security"
  | "reliability"
  | "maintainability"
  | "testing"
  | "performance";
export type AgentStage =
  | "intake"
  | "plan"
  | "inspect"
  | "finding"
  | "evaluate"
  | "report";

export type AgentEvent = {
  id: AgentStage;
  stage: AgentStage;
  status: "pending" | "running" | "complete" | "warning" | "error";
  title: string;
  detail: string;
  artifact?: string;
  timestamp: string;
  durationMs?: number;
};

export type Finding = {
  severity: "critical" | "high" | "medium" | "low" | "info";
  file?: string;
  line?: number;
  title: string;
  evidence: string;
  recommendation: string;
  category: "security" | "reliability" | "maintainability" | "testing" | "performance";
};

export type EvalCard = {
  reproducibility: number;
  traceability: number;
  testability: number;
  confidence: number;
  score: number;
};

export type AuditRequest = {
  content: string;
  inputType: InputType;
  provider: Provider;
  intensity: Intensity;
  rules: AuditRule[];
  source?: {
    kind: "pasted" | "github-pr";
    url?: string;
  };
};

export type AuditInputMeta = {
  inputType: InputType;
  intensity: Intensity;
  rules: AuditRule[];
  contentHash: string;
  estimatedLines: number;
  source?: AuditRequest["source"];
};

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type AuditMetrics = {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  providerLatencyMs: number;
  promptVersion: string;
  tokenUsage?: TokenUsage;
};

export type AuditResponse = {
  id: string;
  createdAt: string;
  provider: Provider;
  model?: string;
  summary: string;
  riskScore: number;
  inputMeta: AuditInputMeta;
  metrics: AuditMetrics;
  events: AgentEvent[];
  findings: Finding[];
  evalCard: EvalCard;
  reportMarkdown: string;
};

export type ParsedAuditInput = {
  inputType: InputType;
  intensity: Intensity;
  contentHash: string;
  estimatedLines: number;
  files: string[];
  lineHints: number[];
};

export type AuditReportInput = Pick<
  AuditResponse,
  "summary" | "riskScore" | "findings" | "evalCard" | "provider" | "model" | "metrics"
> & {
  rules: AuditRule[];
};

export type ProviderAuditResult = Pick<
  AuditResponse,
  "summary" | "riskScore" | "findings" | "model"
> & {
  providerLatencyMs: number;
  tokenUsage?: TokenUsage;
};

export type AuditStreamMessage =
  | { type: "trace"; event: AgentEvent }
  | { type: "result"; result: AuditResponse }
  | { type: "error"; error: string; event?: AgentEvent };
