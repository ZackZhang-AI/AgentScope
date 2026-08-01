import type { AuditReportInput } from "./types";

function formatFindingLine(finding: AuditReportInput["findings"][number], index: number) {
  const location = [finding.file, finding.line ? `line ${finding.line}` : ""]
    .filter(Boolean)
    .join(": ");

  return [
    `### ${index + 1}. ${finding.title}`,
    `- Severity: ${finding.severity}`,
    `- Category: ${finding.category}`,
    location ? `- Location: ${location}` : undefined,
    `- Evidence: ${finding.evidence}`,
    `- Recommendation: ${finding.recommendation}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function generateReportMarkdown({
  summary,
  riskScore,
  findings,
  evalCard,
  provider,
  model,
  metrics,
  rules,
}: AuditReportInput) {
  const findingSection =
    findings.length > 0
      ? findings.map((finding, index) => formatFindingLine(finding, index)).join("\n\n")
      : "No blocking findings were detected in this audit pass.";

  return [
    "# HarnessLab Audit Report",
    "",
    "## Summary",
    summary,
    "",
    `Risk Score: ${riskScore}`,
    "",
    "## Run Metadata",
    `- Provider: ${provider}`,
    `- Model: ${model ?? provider}`,
    `- Rules: ${rules.join(", ")}`,
    `- Duration: ${metrics.durationMs} ms`,
    `- Provider latency: ${metrics.providerLatencyMs} ms`,
    `- Prompt version: ${metrics.promptVersion}`,
    metrics.tokenUsage?.totalTokens !== undefined
      ? `- Token usage: ${metrics.tokenUsage.totalTokens}`
      : undefined,
    "",
    "## Findings",
    findingSection,
    "",
    "## Eval Card",
    `- Reproducibility: ${evalCard.reproducibility}`,
    `- Traceability: ${evalCard.traceability}`,
    `- Testability: ${evalCard.testability}`,
    `- Confidence: ${evalCard.confidence}`,
    `- Score: ${evalCard.score}`,
    "",
    "> Eval card scores describe the audit process quality, not absolute code quality.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

export function generateReviewCommentMarkdown(
  input: Pick<AuditReportInput, "summary" | "riskScore" | "findings">,
) {
  const findings = input.findings
    .map((finding, index) => {
      const location = finding.file
        ? ` (${finding.file}${finding.line ? `:${finding.line}` : ""})`
        : "";
      return `${index + 1}. **[${finding.severity.toUpperCase()}] ${
        finding.title
      }**${location}\n   - Evidence: ${finding.evidence}\n   - Recommendation: ${
        finding.recommendation
      }`;
    })
    .join("\n\n");

  return [
    "## HarnessLab Review",
    "",
    `**Risk score:** ${input.riskScore}/100`,
    "",
    input.summary,
    "",
    findings || "No blocking findings were detected in this audit pass.",
  ].join("\n");
}
