import type { AgentEvent, AuditRequest, EvalCard, Finding, Provider } from "../types";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function evaluateAudit(
  request: AuditRequest,
  provider: Provider,
  events: AgentEvent[],
  findings: Finding[],
): EvalCard {
  const completedStages = new Set(
    events
      .filter((event) => event.status === "complete" || event.status === "warning")
      .filter((event) => event.stage !== "report")
      .map((event) => event.stage),
  ).size;
  const structuredFindings = findings.filter(
    (finding) => finding.evidence.trim() && finding.recommendation.trim(),
  ).length;
  const structuredRatio = findings.length ? structuredFindings / findings.length : 1;
  const locatedFindings = findings.filter((finding) => finding.file || finding.line).length;
  const locationRatio = findings.length ? locatedFindings / findings.length : 1;
  const hasTestingSignal =
    findings.some((finding) => finding.category === "testing") ||
    !request.rules.includes("testing");

  const reproducibility = provider === "mock" ? 98 : 90;
  const traceability = clamp(
    (completedStages / 5) * 55 + structuredRatio * 30 + locationRatio * 15,
  );
  const testability = clamp(65 + structuredRatio * 20 + (hasTestingSignal ? 15 : 0));
  const confidence = clamp(
    50 +
      structuredRatio * 25 +
      (request.intensity === "standard" ? 15 : 8) +
      (provider === "mock" ? 5 : 10),
  );
  const score = clamp(
    (reproducibility + traceability + testability + confidence) / 4,
  );

  return {
    reproducibility,
    traceability,
    testability,
    confidence,
    score,
  };
}
