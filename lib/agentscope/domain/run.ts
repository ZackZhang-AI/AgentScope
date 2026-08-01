import { z } from "zod";
import { isoTimestampSchema, jsonValueSchema, schemaVersion } from "./common";

export const runStatusSchema = z.enum([
  "queued",
  "running",
  "success",
  "success_with_warnings",
  "error",
  "cancelled",
]);

export const terminalRunStatusSchema = z.enum([
  "success",
  "success_with_warnings",
  "error",
  "cancelled",
]);

export const runConfigSnapshotSchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1).optional(),
    promptVersion: z.string().min(1),
    modelParameters: z.record(z.string(), jsonValueSchema).default({}),
    toolVersions: z.record(z.string(), z.string().min(1)).default({}),
  })
  .strict();

export const environmentFingerprintSchema = z
  .object({
    harnessVersion: z.string().min(1),
    runtime: z.string().min(1),
    sourceRevision: z.string().min(1).optional(),
    fingerprint: z.string().min(8),
  })
  .strict();

export const runSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    name: z.string().min(1),
    status: runStatusSchema,
    taskType: z.string().min(1),
    taskInputHash: z.string().regex(/^[a-f0-9]{16,128}$/),
    configSnapshot: runConfigSnapshotSchema,
    environmentFingerprint: environmentFingerprintSchema,
    rootSpanId: z.string().min(1).optional(),
    parentRunId: z.string().min(1).optional(),
    forkedFromSpanId: z.string().min(1).optional(),
    createdAt: isoTimestampSchema,
    startedAt: isoTimestampSchema.optional(),
    completedAt: isoTimestampSchema.optional(),
    schemaVersion: z.literal(schemaVersion),
  })
  .strict()
  .superRefine((run, context) => {
    const hasParent = run.parentRunId !== undefined;
    const hasForkPoint = run.forkedFromSpanId !== undefined;

    if (hasParent !== hasForkPoint) {
      context.addIssue({
        code: "custom",
        message: "A branch run requires both parentRunId and forkedFromSpanId.",
      });
    }

    if (terminalRunStatusSchema.safeParse(run.status).success && !run.completedAt) {
      context.addIssue({
        code: "custom",
        message: "A terminal run requires completedAt.",
        path: ["completedAt"],
      });
    }
  });

const allowedRunTransitions: Record<RunStatus, ReadonlySet<RunStatus>> = {
  queued: new Set(["running", "cancelled"]),
  running: new Set([
    "success",
    "success_with_warnings",
    "error",
    "cancelled",
  ]),
  success: new Set(),
  success_with_warnings: new Set(),
  error: new Set(),
  cancelled: new Set(),
};

export type RunStatus = z.infer<typeof runStatusSchema>;
export type TerminalRunStatus = z.infer<typeof terminalRunStatusSchema>;
export type Run = z.infer<typeof runSchema>;

export function canTransitionRun(from: RunStatus, to: RunStatus) {
  return allowedRunTransitions[from].has(to);
}

export function assertRunTransition(from: RunStatus, to: RunStatus) {
  if (!canTransitionRun(from, to)) {
    throw new Error(`Invalid run status transition: ${from} -> ${to}.`);
  }
}
