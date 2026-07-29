import { z } from "zod";
import {
  getRecordedArtifact,
} from "@/lib/agentscope/execution";
import { getOptionalArtifactStore } from "@/lib/agentscope/infrastructure/postgres/database";

const artifactIdSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9:_-]+$/);

export async function GET(
  _request: Request,
  context: { params: Promise<{ artifactId: string }> },
) {
  const parsed = artifactIdSchema.safeParse((await context.params).artifactId);
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_ARTIFACT_ID", error: "Invalid artifact identifier." },
      { status: 400 },
    );
  }
  const persistent = getOptionalArtifactStore();
  const artifact =
    (persistent ? await persistent.get(parsed.data) : null) ??
    (await getRecordedArtifact(parsed.data));
  if (!artifact || artifact.visibility !== "user") {
    return Response.json(
      { code: "ARTIFACT_NOT_FOUND", error: "Artifact not found." },
      { status: 404 },
    );
  }
  return Response.json(
    { artifact },
    { headers: { "cache-control": "private, no-store" } },
  );
}
