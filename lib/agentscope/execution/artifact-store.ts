import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type {
  ArtifactContentStore,
  ArtifactInput,
  StoredArtifact,
} from "./contracts";

export const MAX_ARTIFACT_BYTES = 256 * 1024;
export const MAX_RUN_ARTIFACT_BYTES = 1024 * 1024;

const secretPatterns = [
  /\b(sk-[A-Za-z0-9_-]{16,})\b/g,
  /\b(Bearer\s+)[A-Za-z0-9._~+/-]{12,}=*/gi,
  /\b([A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*=\s*)[^\s"'`]+/g,
];

export class ArtifactLimitError extends Error {
  code = "ARTIFACT_SIZE_LIMIT_EXCEEDED";
}

export function redactArtifactContent(content: string) {
  let redacted = content;
  for (const pattern of secretPatterns) {
    redacted = redacted.replace(pattern, (_match, prefix?: string) =>
      prefix ? `${prefix}[REDACTED]` : "[REDACTED]",
    );
  }
  return {
    content: redacted,
    changed: redacted !== content,
  };
}

function prepareArtifact(input: ArtifactInput): StoredArtifact {
  const sizeBeforeRedaction = Buffer.byteLength(input.content, "utf8");
  if (sizeBeforeRedaction > MAX_ARTIFACT_BYTES) {
    throw new ArtifactLimitError(
      `Artifact exceeds the ${MAX_ARTIFACT_BYTES}-byte limit.`,
    );
  }

  const redaction = redactArtifactContent(input.content);
  const sizeBytes = Buffer.byteLength(redaction.content, "utf8");
  const contentHash = createHash("sha256")
    .update(redaction.content)
    .digest("hex");

  return {
    id: `artifact_${randomUUID()}`,
    runId: input.runId,
    spanId: input.spanId,
    kind: input.kind,
    mediaType: input.mediaType,
    name: input.name,
    content: redaction.content,
    contentHash,
    sizeBytes,
    redactionState: redaction.changed ? "redacted" : "clean",
    visibility: input.visibility ?? "user",
    createdAt: new Date().toISOString(),
  };
}

export class MemoryArtifactStore implements ArtifactContentStore {
  readonly #artifacts = new Map<string, StoredArtifact>();

  async put(input: ArtifactInput) {
    const artifact = prepareArtifact(input);
    const runBytes = [...this.#artifacts.values()]
      .filter((item) => item.runId === input.runId)
      .reduce((total, item) => total + item.sizeBytes, 0);
    if (runBytes + artifact.sizeBytes > MAX_RUN_ARTIFACT_BYTES) {
      throw new ArtifactLimitError(
        `Run artifacts exceed the ${MAX_RUN_ARTIFACT_BYTES}-byte limit.`,
      );
    }
    this.#artifacts.set(artifact.id, artifact);
    return artifact;
  }

  async get(artifactId: string) {
    return this.#artifacts.get(artifactId) ?? null;
  }
}

function rowToArtifact(row: Record<string, unknown>): StoredArtifact {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    ...(row.span_id ? { spanId: String(row.span_id) } : {}),
    kind: row.kind as StoredArtifact["kind"],
    mediaType: row.media_type as StoredArtifact["mediaType"],
    name: String(row.name),
    content: String(row.content),
    contentHash: String(row.content_hash),
    sizeBytes: Number(row.size_bytes),
    redactionState: row.redaction_state as StoredArtifact["redactionState"],
    visibility: row.visibility as StoredArtifact["visibility"],
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export class PostgresArtifactStore implements ArtifactContentStore {
  constructor(private readonly pool: Pool) {}

  async put(input: ArtifactInput) {
    const artifact = prepareArtifact(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.lockRun(client, input.runId);
      const totalResult = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(size_bytes), 0)::text AS total
           FROM agentscope_artifacts
          WHERE run_id = $1`,
        [input.runId],
      );
      const total = Number(totalResult.rows[0]?.total ?? 0);
      if (total + artifact.sizeBytes > MAX_RUN_ARTIFACT_BYTES) {
        throw new ArtifactLimitError(
          `Run artifacts exceed the ${MAX_RUN_ARTIFACT_BYTES}-byte limit.`,
        );
      }
      await client.query(
        `INSERT INTO agentscope_artifacts (
           id, run_id, span_id, kind, media_type, name, content, content_hash,
           size_bytes, redaction_state, visibility, created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
         )`,
        [
          artifact.id,
          artifact.runId,
          artifact.spanId ?? null,
          artifact.kind,
          artifact.mediaType,
          artifact.name,
          artifact.content,
          artifact.contentHash,
          artifact.sizeBytes,
          artifact.redactionState,
          artifact.visibility,
          artifact.createdAt,
        ],
      );
      await client.query("COMMIT");
      return artifact;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async get(artifactId: string) {
    const result = await this.pool.query(
      `SELECT *
         FROM agentscope_artifacts
        WHERE id = $1`,
      [artifactId],
    );
    return result.rows[0] ? rowToArtifact(result.rows[0]) : null;
  }

  private async lockRun(client: PoolClient, runId: string) {
    const result = await client.query(
      "SELECT id FROM agentscope_runs WHERE id = $1 FOR UPDATE",
      [runId],
    );
    if (result.rowCount !== 1) {
      throw new Error(`Run ${runId} must exist before storing artifacts.`);
    }
  }
}
