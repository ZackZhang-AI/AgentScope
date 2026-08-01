import { z } from "zod";
import { isoTimestampSchema } from "../domain/common";
import type { RunProjection } from "../domain/projection";
import {
  diagnosticSchema,
  diagnoseRun,
} from "../diagnostics/diagnose-run";
import {
  evaluateRun,
  runEvalReportSchema,
} from "../eval/evaluate-run";

export const analysisRecordSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: z.string().min(1),
      runId: z.string().min(1),
      type: z.literal("diagnostics"),
      algorithmVersion: z.literal("agentscope-diagnostics-v1"),
      inputTraceSequence: z.number().int().positive(),
      createdAt: isoTimestampSchema,
      payload: z
        .object({
          items: z.array(diagnosticSchema),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      runId: z.string().min(1),
      type: z.literal("eval"),
      algorithmVersion: z.literal("agentscope-deterministic-v1"),
      inputTraceSequence: z.number().int().positive(),
      createdAt: isoTimestampSchema,
      payload: runEvalReportSchema,
    })
    .strict(),
]);

export type AnalysisRecord = z.infer<typeof analysisRecordSchema>;

export function deriveRunAnalyses(
  projection: RunProjection,
  createdAt = new Date().toISOString(),
): AnalysisRecord[] {
  return [
    analysisRecordSchema.parse({
      id: `${projection.run.id}:diagnostics:v1:${projection.lastSequence}`,
      runId: projection.run.id,
      type: "diagnostics",
      algorithmVersion: "agentscope-diagnostics-v1",
      inputTraceSequence: projection.lastSequence,
      createdAt,
      payload: { items: diagnoseRun(projection) },
    }),
    analysisRecordSchema.parse({
      id: `${projection.run.id}:eval:v1:${projection.lastSequence}`,
      runId: projection.run.id,
      type: "eval",
      algorithmVersion: "agentscope-deterministic-v1",
      inputTraceSequence: projection.lastSequence,
      createdAt,
      payload: evaluateRun(projection),
    }),
  ];
}
