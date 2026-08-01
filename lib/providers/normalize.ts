import { auditResponsePayloadSchema } from "../schemas";
import type { ProviderAuditResult, TokenUsage } from "../types";

export function extractJsonObject(text: string) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + 1);
}

export function normalizeProviderPayload(
  rawPayload: unknown,
  model: string,
  providerLatencyMs: number,
  tokenUsage?: TokenUsage,
): ProviderAuditResult {
  const payload = auditResponsePayloadSchema.parse(rawPayload);

  return {
    ...payload,
    model,
    providerLatencyMs,
    tokenUsage,
  };
}
