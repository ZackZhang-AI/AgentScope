import { z } from "zod";
import { analysisRecordSchema, deriveRunAnalyses } from "../analysis/analysis-record";
import {
  projectTraceEvents,
  runProjectionSchema,
  traceEventSchema,
  type RunProjection,
  type TraceEvent,
} from "../domain";

export const runBundleSchema = z
  .object({
    kind: z.literal("agentscope.run.bundle"),
    bundleVersion: z.literal(1),
    exportedAt: z.iso.datetime(),
    source: z.enum(["event_stream", "projection_snapshot"]),
    runId: z.string().min(1),
    events: z.array(traceEventSchema),
    projection: runProjectionSchema,
    analyses: z.array(analysisRecordSchema),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export type RunBundle = z.infer<typeof runBundleSchema>;

export function createRunBundle(
  projection: RunProjection,
  events: readonly TraceEvent[],
  exportedAt = new Date().toISOString(),
): RunBundle {
  const hasCompleteEvents =
    events.length > 0 &&
    events[0]?.type === "run.created" &&
    events.at(-1)?.sequence === projection.lastSequence;
  return runBundleSchema.parse({
    kind: "agentscope.run.bundle",
    bundleVersion: 1,
    exportedAt,
    source: hasCompleteEvents ? "event_stream" : "projection_snapshot",
    runId: projection.run.id,
    events: hasCompleteEvents ? events : [],
    projection,
    analyses: deriveRunAnalyses(projection, exportedAt),
    limitations: hasCompleteEvents
      ? []
      : ["Raw trace events were unavailable; this bundle contains a projection snapshot."],
  });
}

export function parseRunBundle(input: unknown): RunBundle {
  const bundle = runBundleSchema.parse(input);
  if (bundle.runId !== bundle.projection.run.id) {
    throw new Error("Bundle runId does not match its projection.");
  }
  if (bundle.events.length > 0) {
    const recomputed = projectTraceEvents(bundle.events);
    if (JSON.stringify(recomputed) !== JSON.stringify(bundle.projection)) {
      throw new Error("Bundle projection does not match its immutable event stream.");
    }
  }
  if (bundle.analyses.some((analysis) => analysis.runId !== bundle.runId)) {
    throw new Error("Bundle analyses reference a different run.");
  }
  return bundle;
}
