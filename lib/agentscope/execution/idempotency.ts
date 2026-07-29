import { createHash } from "node:crypto";

type Entry = { runId: string; createdAt: number };

const runtime = globalThis as typeof globalThis & {
  agentscopeIdempotency?: Map<string, Entry>;
};

function registry() {
  runtime.agentscopeIdempotency ??= new Map();
  return runtime.agentscopeIdempotency;
}

export function reserveIdempotentRun(
  namespace: "run" | "fork",
  key: string | null,
  fingerprint: string,
) {
  if (!key) return { runId: undefined, duplicate: false };
  const normalized = key.trim();
  if (!normalized || normalized.length > 200) {
    throw new Error("Idempotency-Key must contain between 1 and 200 characters.");
  }
  const lookup = `${namespace}:${normalized}`;
  const existing = registry().get(lookup);
  if (existing) return { runId: existing.runId, duplicate: true };

  const runId = `codefix_${createHash("sha256")
    .update(`${lookup}:${fingerprint}`)
    .digest("hex")
    .slice(0, 24)}`;
  registry().set(lookup, { runId, createdAt: Date.now() });
  if (registry().size > 500) {
    const oldest = [...registry().entries()].sort(
      ([, left], [, right]) => left.createdAt - right.createdAt,
    )[0]?.[0];
    if (oldest) registry().delete(oldest);
  }
  return { runId, duplicate: false };
}

export function resetIdempotencyForTests() {
  registry().clear();
}
