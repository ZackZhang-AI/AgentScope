import type { AuditRequest, ProviderAuditResult } from "../types";
import { runDeepSeekAudit } from "./deepseek";
import { runMiniMaxAudit } from "./minimax";
import { runMockAudit } from "./mock";

export async function runAuditProvider(
  request: AuditRequest,
): Promise<ProviderAuditResult> {
  if (request.provider === "deepseek") {
    return runDeepSeekAudit(request);
  }

  if (request.provider === "minimax") {
    return runMiniMaxAudit(request);
  }

  return runMockAudit(request);
}
