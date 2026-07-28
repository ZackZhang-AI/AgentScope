import { z } from "zod";

export const MAX_CONTENT_LENGTH = 60000;
export const auditRuleSchema = z.enum([
  "security",
  "reliability",
  "maintainability",
  "testing",
  "performance",
]);

export const auditRequestSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Paste a diff or file snippet before running an audit.")
    .max(MAX_CONTENT_LENGTH, "Content is too large for the MVP audit path."),
  inputType: z.enum(["diff", "files"]),
  provider: z.enum(["mock", "deepseek", "minimax"]),
  intensity: z.enum(["quick", "standard"]),
  rules: z.array(auditRuleSchema).min(1, "Select at least one audit rule.").default([
    "security",
    "reliability",
    "testing",
    "maintainability",
  ]),
  source: z
    .object({
      kind: z.enum(["pasted", "github-pr"]),
      url: z.url().optional(),
    })
    .optional(),
});

export const agentEventSchema = z.object({
  id: z.enum(["intake", "plan", "inspect", "finding", "evaluate", "report"]),
  stage: z.enum(["intake", "plan", "inspect", "finding", "evaluate", "report"]),
  status: z.enum(["pending", "running", "complete", "warning", "error"]),
  title: z.string().min(1),
  detail: z.string().min(1),
  artifact: z.string().optional(),
  timestamp: z.string().min(1),
  durationMs: z.number().int().nonnegative().optional(),
});

export const findingSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  title: z.string().min(1),
  evidence: z.string().min(1),
  recommendation: z.string().min(1),
  category: z.enum(["security", "reliability", "maintainability", "testing", "performance"]),
});

export const evalCardSchema = z.object({
  reproducibility: z.number().min(0).max(100),
  traceability: z.number().min(0).max(100),
  testability: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  score: z.number().min(0).max(100),
});

export const auditResponsePayloadSchema = z.object({
  summary: z.string().min(1),
  riskScore: z.number().min(0).max(100),
  findings: z.array(findingSchema),
});

export const auditResponseSchema = auditResponsePayloadSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  provider: z.enum(["mock", "deepseek", "minimax"]),
  model: z.string().optional(),
  inputMeta: z.object({
    inputType: z.enum(["diff", "files"]),
    intensity: z.enum(["quick", "standard"]),
    rules: z.array(auditRuleSchema).min(1),
    contentHash: z.string().regex(/^[a-f0-9]{16}$/),
    estimatedLines: z.number().int().nonnegative(),
    source: z
      .object({
        kind: z.enum(["pasted", "github-pr"]),
        url: z.url().optional(),
      })
      .optional(),
  }),
  metrics: z.object({
    startedAt: z.string().min(1),
    completedAt: z.string().min(1),
    durationMs: z.number().int().nonnegative(),
    providerLatencyMs: z.number().int().nonnegative(),
    promptVersion: z.string().min(1),
    tokenUsage: z
      .object({
        inputTokens: z.number().int().nonnegative().optional(),
        outputTokens: z.number().int().nonnegative().optional(),
        totalTokens: z.number().int().nonnegative().optional(),
      })
      .optional(),
  }),
  events: z.array(agentEventSchema).min(1),
  evalCard: evalCardSchema,
  reportMarkdown: z.string().min(1),
});

export type AuditRequestInput = z.infer<typeof auditRequestSchema>;
