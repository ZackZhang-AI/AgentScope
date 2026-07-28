import { z } from "zod";
import { artifactSchema } from "./artifact";
import { replayCheckpointSchema } from "./checkpoint";
import { isoTimestampSchema, schemaVersion } from "./common";
import { runSchema, terminalRunStatusSchema } from "./run";
import {
  payloadRefSchema,
  replayabilitySchema,
  spanMetricsSchema,
  spanSchema,
  terminalSpanStatusSchema,
  traceErrorSchema,
} from "./span";

const eventBase = {
  eventId: z.string().min(1),
  runId: z.string().min(1),
  sequence: z.number().int().positive(),
  occurredAt: isoTimestampSchema,
  receivedAt: isoTimestampSchema,
  schemaVersion: z.literal(schemaVersion),
};

export const traceEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...eventBase,
      type: z.literal("run.created"),
      payload: z.object({ run: runSchema }).strict(),
    })
    .strict(),
  z
    .object({
      ...eventBase,
      type: z.literal("run.started"),
      payload: z.object({ startedAt: isoTimestampSchema }).strict(),
    })
    .strict(),
  z
    .object({
      ...eventBase,
      type: z.literal("span.started"),
      spanId: z.string().min(1),
      payload: z.object({ span: spanSchema }).strict(),
    })
    .strict(),
  z
    .object({
      ...eventBase,
      type: z.literal("span.ended"),
      spanId: z.string().min(1),
      payload: z
        .object({
          status: terminalSpanStatusSchema,
          endedAt: isoTimestampSchema,
          outputRef: payloadRefSchema.optional(),
          metrics: spanMetricsSchema.optional(),
          error: traceErrorSchema.optional(),
          replayability: replayabilitySchema.optional(),
        })
        .strict()
        .superRefine((payload, context) => {
          if (payload.status === "error" && !payload.error) {
            context.addIssue({
              code: "custom",
              message: "An error span event requires structured error details.",
              path: ["error"],
            });
          }
        }),
    })
    .strict(),
  z
    .object({
      ...eventBase,
      type: z.literal("artifact.created"),
      spanId: z.string().min(1).optional(),
      payload: z.object({ artifact: artifactSchema }).strict(),
    })
    .strict(),
  z
    .object({
      ...eventBase,
      type: z.literal("checkpoint.created"),
      spanId: z.string().min(1),
      payload: z.object({ checkpoint: replayCheckpointSchema }).strict(),
    })
    .strict(),
  z
    .object({
      ...eventBase,
      type: z.literal("run.ended"),
      payload: z
        .object({
          status: terminalRunStatusSchema,
          completedAt: isoTimestampSchema,
        })
        .strict(),
    })
    .strict(),
]);

export const traceFixtureSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    events: z.array(traceEventSchema).min(1),
  })
  .strict();

export type TraceEvent = z.infer<typeof traceEventSchema>;
export type TraceFixture = z.infer<typeof traceFixtureSchema>;
