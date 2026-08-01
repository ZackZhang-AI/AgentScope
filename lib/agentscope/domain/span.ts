import { z } from "zod";
import {
  isoTimestampSchema,
  jsonValueSchema,
  schemaVersion,
} from "./common";

export const spanKindSchema = z.enum([
  "agent",
  "plan",
  "model",
  "tool",
  "handoff",
  "guardrail",
  "eval",
  "custom",
]);

export const spanStatusSchema = z.enum([
  "running",
  "success",
  "error",
  "cancelled",
  "skipped",
]);

export const terminalSpanStatusSchema = z.enum([
  "success",
  "error",
  "cancelled",
  "skipped",
]);

export const errorTypeSchema = z.enum([
  "model_error",
  "tool_error",
  "validation_error",
  "timeout",
  "rate_limit",
  "cancelled",
  "runner_interrupted",
  "unknown_error",
]);

export const traceErrorSchema = z
  .object({
    type: errorTypeSchema,
    message: z.string().min(1),
    code: z.string().min(1).optional(),
    retryable: z.boolean().optional(),
  })
  .strict();

export const payloadRefSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("inline"),
      data: jsonValueSchema,
      redacted: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      kind: z.literal("artifact"),
      artifactId: z.string().min(1),
      summary: z.string().min(1).optional(),
      redacted: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      kind: z.literal("omitted"),
      reason: z.string().min(1),
      contentHash: z.string().min(8).optional(),
    })
    .strict(),
]);

export const tokenUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
    cachedInputTokens: z.number().int().nonnegative().optional(),
    reasoningOutputTokens: z.number().int().nonnegative().optional(),
  })
  .strict();

export const spanMetricsSchema = z
  .object({
    durationMs: z.number().int().nonnegative().optional(),
    timeToFirstTokenMs: z.number().int().nonnegative().optional(),
    tokenUsage: tokenUsageSchema.optional(),
  })
  .strict();

export const replayabilitySchema = z
  .object({
    level: z.enum(["high", "medium", "low", "blocked"]),
    reason: z.string().min(1),
    checkpointId: z.string().min(1).optional(),
  })
  .strict();

export const spanSchema = z
  .object({
    id: z.string().min(1),
    runId: z.string().min(1),
    parentSpanId: z.string().min(1).optional(),
    kind: spanKindSchema,
    name: z.string().min(1),
    status: spanStatusSchema,
    sequence: z.number().int().positive(),
    startedAt: isoTimestampSchema,
    endedAt: isoTimestampSchema.optional(),
    inputRef: payloadRefSchema.optional(),
    outputRef: payloadRefSchema.optional(),
    attributes: z.record(z.string(), jsonValueSchema).default({}),
    error: traceErrorSchema.optional(),
    metrics: spanMetricsSchema.optional(),
    replayability: replayabilitySchema.optional(),
    schemaVersion: z.literal(schemaVersion),
  })
  .strict()
  .superRefine((span, context) => {
    if (
      terminalSpanStatusSchema.safeParse(span.status).success &&
      !span.endedAt
    ) {
      context.addIssue({
        code: "custom",
        message: "A terminal span requires endedAt.",
        path: ["endedAt"],
      });
    }

    if (span.status === "error" && !span.error) {
      context.addIssue({
        code: "custom",
        message: "An error span requires structured error details.",
        path: ["error"],
      });
    }
  });

const allowedSpanTransitions: Record<SpanStatus, ReadonlySet<SpanStatus>> = {
  running: new Set(["success", "error", "cancelled", "skipped"]),
  success: new Set(),
  error: new Set(),
  cancelled: new Set(),
  skipped: new Set(),
};

export type SpanKind = z.infer<typeof spanKindSchema>;
export type SpanStatus = z.infer<typeof spanStatusSchema>;
export type TerminalSpanStatus = z.infer<typeof terminalSpanStatusSchema>;
export type TraceError = z.infer<typeof traceErrorSchema>;
export type PayloadRef = z.infer<typeof payloadRefSchema>;
export type SpanMetrics = z.infer<typeof spanMetricsSchema>;
export type Replayability = z.infer<typeof replayabilitySchema>;
export type Span = z.infer<typeof spanSchema>;

export function canTransitionSpan(from: SpanStatus, to: SpanStatus) {
  return allowedSpanTransitions[from].has(to);
}

export function assertSpanTransition(from: SpanStatus, to: SpanStatus) {
  if (!canTransitionSpan(from, to)) {
    throw new Error(`Invalid span status transition: ${from} -> ${to}.`);
  }
}
