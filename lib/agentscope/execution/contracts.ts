import { z } from "zod";
import type {
  JsonValue,
  RunProjection,
  ToolSideEffect,
  TraceEvent,
} from "../domain";

export const codeFixRunRequestSchema = z
  .object({
    taskType: z.literal("code_fix"),
    scenarioId: z.literal("buggy-auth-api"),
    executionMode: z.enum(["recorded", "sandbox"]),
    decisionProvider: z.enum(["fixture", "deepseek", "minimax"]),
  })
  .strict()
  .superRefine((request, context) => {
    if (
      request.executionMode === "recorded" &&
      request.decisionProvider !== "fixture"
    ) {
      context.addIssue({
        code: "custom",
        message: "Recorded runs only support the fixture decision provider.",
        path: ["decisionProvider"],
      });
    }
  });

const readFileActionSchema = z
  .object({
    type: z.literal("tool"),
    tool: z.literal("read_file"),
    input: z.object({ path: z.string().min(1).max(200) }).strict(),
    rationale: z.string().min(1).max(500),
  })
  .strict();

const searchCodeActionSchema = z
  .object({
    type: z.literal("tool"),
    tool: z.literal("search_code"),
    input: z
      .object({
        query: z.string().min(1).max(200),
        path: z.string().min(1).max(200).optional(),
      })
      .strict(),
    rationale: z.string().min(1).max(500),
  })
  .strict();

const applyPatchActionSchema = z
  .object({
    type: z.literal("tool"),
    tool: z.literal("apply_patch"),
    input: z
      .object({
        path: z.string().min(1).max(200),
        search: z.string().min(1).max(12_000),
        replacement: z.string().max(12_000),
      })
      .strict(),
    rationale: z.string().min(1).max(500),
  })
  .strict();

const runTestsActionSchema = z
  .object({
    type: z.literal("tool"),
    tool: z.literal("run_tests"),
    input: z.object({}).strict(),
    rationale: z.string().min(1).max(500),
  })
  .strict();

const finishActionSchema = z
  .object({
    type: z.literal("finish"),
    outcome: z.enum(["success", "error"]),
    summary: z.string().min(1).max(1_000),
  })
  .strict();

export const agentActionSchema = z.union([
  readFileActionSchema,
  searchCodeActionSchema,
  applyPatchActionSchema,
  runTestsActionSchema,
  finishActionSchema,
]);

export type CodeFixRunRequest = z.infer<typeof codeFixRunRequestSchema>;
export type AgentAction = z.infer<typeof agentActionSchema>;
export type ToolAction = Extract<AgentAction, { type: "tool" }>;
export type ToolName = ToolAction["tool"];

export type DecisionContext = {
  runId: string;
  scenarioId: CodeFixRunRequest["scenarioId"];
  step: number;
  previousResults: ToolExecutionResult[];
  availableTools: ToolDescription[];
};

export type DecisionResult = {
  action: AgentAction;
  model: string;
  durationMs: number;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

export interface DecisionProvider {
  readonly id: CodeFixRunRequest["decisionProvider"];
  next(context: DecisionContext): Promise<DecisionResult>;
}

export type ToolDescription = {
  name: ToolName;
  version: string;
  sideEffect: ToolSideEffect;
  description: string;
};

export type WorkspaceSnapshot = {
  ref: string;
  hash: string;
  files: Record<string, string>;
};

export type ToolExecutionResult = {
  tool: ToolName;
  status: "success" | "error";
  output: JsonValue;
  durationMs: number;
  workspaceHash: string;
  progressHash: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  artifact?: {
    kind: "diff" | "text" | "json";
    mediaType: "text/x-diff" | "text/plain" | "application/json";
    name: string;
    content: string;
  };
};

export interface WorkspaceSandbox {
  execute(action: ToolAction): Promise<ToolExecutionResult>;
  snapshot(): Promise<WorkspaceSnapshot>;
  dispose(): Promise<void>;
}

export type ArtifactInput = {
  runId: string;
  spanId?: string;
  kind: "diff" | "text" | "json";
  mediaType: "text/x-diff" | "text/plain" | "application/json";
  name: string;
  content: string;
  visibility?: "user" | "internal";
};

export type StoredArtifact = {
  id: string;
  runId: string;
  spanId?: string;
  kind: ArtifactInput["kind"];
  mediaType: ArtifactInput["mediaType"];
  name: string;
  content: string;
  contentHash: string;
  sizeBytes: number;
  redactionState: "clean" | "redacted" | "blocked";
  visibility: "user" | "internal";
  createdAt: string;
};

export interface ArtifactContentStore {
  put(input: ArtifactInput): Promise<StoredArtifact>;
  get(artifactId: string): Promise<StoredArtifact | null>;
}

export type ToolExecutionContext = {
  workspace: WorkspaceSandbox;
};

export type ToolDefinition = ToolDescription & {
  execute(
    action: ToolAction,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult>;
};

export interface RunExecutor {
  execute(command: ExecuteRunCommand): AsyncIterable<RunStreamMessage>;
}

export type ExecuteRunCommand = {
  request: CodeFixRunRequest;
  provider: DecisionProvider;
  workspace: WorkspaceSandbox;
  artifactStore?: ArtifactContentStore;
  branch?: {
    parentRunId: string;
    forkedFromSpanId: string;
  };
};

export type CodeFixRunResult = {
  id: string;
  createdAt: string;
  summary: string;
  trace: RunProjection;
};

export type RunStreamMessage =
  | { type: "trace_event"; event: TraceEvent }
  | { type: "result"; result: CodeFixRunResult }
  | { type: "error"; error: string };
