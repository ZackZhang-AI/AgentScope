import { z } from "zod";
import {
  isoTimestampSchema,
  jsonValueSchema,
  schemaVersion,
} from "./common";

export const toolSideEffectSchema = z.enum([
  "read_only",
  "idempotent",
  "side_effect",
  "destructive",
  "unknown",
]);

export const replayCheckpointSchema = z
  .object({
    id: z.string().min(1),
    runId: z.string().min(1),
    spanId: z.string().min(1),
    stateRef: z.string().min(1),
    configSnapshot: z.record(z.string(), jsonValueSchema),
    toolPolicySnapshot: z.record(z.string(), toolSideEffectSchema),
    completeness: z.enum(["complete", "partial", "blocked"]),
    blockedReasons: z.array(z.string().min(1)).default([]),
    createdAt: isoTimestampSchema,
    schemaVersion: z.literal(schemaVersion),
  })
  .strict()
  .superRefine((checkpoint, context) => {
    if (
      checkpoint.completeness === "blocked" &&
      checkpoint.blockedReasons.length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: "A blocked checkpoint requires at least one reason.",
        path: ["blockedReasons"],
      });
    }
  });

export type ToolSideEffect = z.infer<typeof toolSideEffectSchema>;
export type ReplayCheckpoint = z.infer<typeof replayCheckpointSchema>;
