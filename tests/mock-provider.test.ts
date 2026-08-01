import { describe, expect, it } from "vitest";
import { runAudit } from "../lib/audit/run-audit";
import { runMockAudit } from "../lib/providers/mock";
import { samples } from "../lib/samples";

describe("runMockAudit", () => {
  it("returns an authorization finding for auth-like changes", async () => {
    const result = await runMockAudit({
      content: samples.reactAuthBug.content,
      inputType: samples.reactAuthBug.inputType,
      provider: "mock",
      intensity: "standard",
      rules: ["security", "reliability", "testing", "maintainability"],
    });

    expect(result.findings.some((finding) => finding.category === "security")).toBe(true);
    expect(result.findings[0]?.title).toMatch(/authorization|auth/i);
  });

  it("builds the full deterministic harness response", async () => {
    const result = await runAudit({
      content: samples.reactAuthBug.content,
      inputType: samples.reactAuthBug.inputType,
      provider: "mock",
      intensity: "standard",
      rules: ["security", "reliability", "testing", "maintainability"],
    });

    expect(result.events.map((event) => event.stage)).toEqual([
      "intake",
      "plan",
      "inspect",
      "finding",
      "evaluate",
      "report",
    ]);
    expect(result.reportMarkdown).toContain("Risk Score");
    expect(result.metrics.promptVersion).toBe("audit-v2");
    expect(result.evalCard.reproducibility).toBe(98);
  });

  it("returns a SQL injection finding for query string assembly", async () => {
    const result = await runMockAudit({
      content: samples.sqlInjectionRisk.content,
      inputType: samples.sqlInjectionRisk.inputType,
      provider: "mock",
      intensity: "quick",
      rules: ["security", "testing"],
    });

    expect(result.findings.some((finding) => /injection/i.test(finding.title))).toBe(true);
    expect(result.riskScore).toBeGreaterThanOrEqual(60);
  });
});
