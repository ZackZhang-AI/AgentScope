import { describe, expect, it } from "vitest";
import { generateReportMarkdown } from "../lib/report";

describe("generateReportMarkdown", () => {
  it("includes summary, risk score, findings, evidence, and recommendations", () => {
    const markdown = generateReportMarkdown({
      summary: "Audit found one authorization issue.",
      riskScore: 72,
      findings: [
        {
          severity: "high",
          category: "security",
          file: "app/api/users.ts",
          line: 18,
          title: "Missing authorization check",
          evidence: "The route trusts userId from the request.",
          recommendation: "Resolve the user from the session before reading data.",
        },
      ],
      evalCard: {
        reproducibility: 91,
        traceability: 88,
        testability: 74,
        confidence: 82,
        score: 84,
      },
      provider: "mock",
      model: "mock-heuristic-v2",
      rules: ["security", "testing"],
      metrics: {
        startedAt: "2026-07-28T00:00:00.000Z",
        completedAt: "2026-07-28T00:00:00.010Z",
        durationMs: 10,
        providerLatencyMs: 1,
        promptVersion: "audit-v2",
      },
    });

    expect(markdown).toContain("Audit found one authorization issue.");
    expect(markdown).toContain("Risk Score: 72");
    expect(markdown).toContain("Missing authorization check");
    expect(markdown).toContain("The route trusts userId");
    expect(markdown).toContain("Resolve the user");
    expect(markdown).toContain("Prompt version: audit-v2");
  });
});
