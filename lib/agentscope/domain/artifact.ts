import { z } from "zod";
import { isoTimestampSchema, schemaVersion } from "./common";

export const artifactSchema = z
  .object({
    id: z.string().min(1),
    runId: z.string().min(1),
    spanId: z.string().min(1).optional(),
    kind: z.enum(["report", "diff", "file", "json", "text", "image"]),
    mediaType: z.string().min(1),
    storageKey: z.string().min(1),
    contentHash: z.string().regex(/^[a-f0-9]{16,128}$/),
    sizeBytes: z.number().int().nonnegative(),
    redactionState: z.enum(["unscanned", "redacted", "blocked"]),
    createdAt: isoTimestampSchema,
    schemaVersion: z.literal(schemaVersion),
  })
  .strict();

export type Artifact = z.infer<typeof artifactSchema>;
