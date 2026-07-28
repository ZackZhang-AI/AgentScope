import { parseAuditInput } from "../parser";
import type { AuditRequest, Finding, ProviderAuditResult } from "../types";

function includesAny(content: string, terms: string[]) {
  const lower = content.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function buildFindings(request: AuditRequest): Finding[] {
  const parsed = parseAuditInput(request);
  const file = parsed.files[0] ?? "pasted-snippet.ts";
  const line = parsed.lineHints[0] ?? 1;
  const findings: Finding[] = [];
  const enabled = new Set(request.rules);

  if (
    enabled.has("security") &&
    includesAny(request.content, ["auth", "userid", "admin"])
  ) {
    findings.push({
      severity: "high",
      category: "security",
      file,
      line,
      title: "Missing authorization boundary",
      evidence:
        "The change references userId, admin, or auth-sensitive flow without a visible server-side permission check.",
      recommendation:
        "Resolve the acting user from a trusted session and enforce authorization before reading or mutating protected data.",
    });
  }

  if (
    enabled.has("security") &&
    includesAny(request.content, ["query", "sql", "select *", "${"])
  ) {
    findings.push({
      severity: "high",
      category: "security",
      file,
      line,
      title: "Possible SQL injection through string-built query",
      evidence:
        "The snippet builds a query string from runtime values instead of using a parameterized statement.",
      recommendation:
        "Replace string interpolation with prepared statements or ORM parameter binding.",
    });
  }

  if (
    enabled.has("reliability") &&
    (/\bcatch\s*\([^)]*\)\s*{\s*}/m.test(request.content) ||
      includesAny(request.content, ["catch (", "catch("]))
  ) {
    findings.push({
      severity: "medium",
      category: "reliability",
      file,
      line,
      title: "Error path may be swallowed",
      evidence:
        "The change includes a catch path without clear logging, recovery, or user-facing failure handling.",
      recommendation:
        "Log the failure context and return a typed error response or retry path.",
    });
  }

  if (
    enabled.has("performance") &&
    includesAny(request.content, ["for (", ".map(async", "n+1", "await fetch"])
  ) {
    findings.push({
      severity: "low",
      category: "performance",
      file,
      line,
      title: "Potential repeated work in a hot path",
      evidence:
        "The submitted code contains a loop or asynchronous mapping pattern that may trigger repeated I/O.",
      recommendation:
        "Batch independent I/O and verify the path with a representative performance test.",
    });
  }

  if (
    enabled.has("testing") &&
    !includesAny(request.content, [
      "test(",
      "expect(",
      ".spec.",
      ".test.",
      "describe(",
    ])
  ) {
    findings.push({
      severity: "medium",
      category: "testing",
      file,
      title: "Risky change lacks test evidence",
      evidence:
        "No test file or assertion marker appears in the submitted diff or snippet.",
      recommendation:
        "Add a focused regression test that covers the changed authorization, validation, or persistence behavior.",
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "info",
      category: "maintainability",
      file,
      title: "No high-signal issue detected by mock heuristics",
      evidence:
        "The deterministic mock rules did not match a high-signal risk in the submitted content.",
      recommendation:
        "Run a semantic provider and manually verify the selected review rules before relying on this result.",
    });
  }

  return findings;
}

function riskScore(findings: Finding[]) {
  const weights = { critical: 95, high: 72, medium: 48, low: 26, info: 10 };
  return Math.min(
    100,
    Math.max(...findings.map((finding) => weights[finding.severity])),
  );
}

export async function runMockAudit(
  request: AuditRequest,
): Promise<ProviderAuditResult> {
  const startedAt = Date.now();
  const findings = buildFindings(request);
  const summary =
    findings[0]?.severity === "info"
      ? "Mock audit did not detect blocking risk, but recommends a semantic provider pass."
      : `Mock audit found ${findings.length} review concern${
          findings.length === 1 ? "" : "s"
        }, led by ${findings[0]?.title.toLowerCase()}.`;

  return {
    model: "mock-heuristic-v2",
    summary,
    riskScore: riskScore(findings),
    findings,
    providerLatencyMs: Date.now() - startedAt,
  };
}
