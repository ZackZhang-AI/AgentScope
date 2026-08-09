import { describe, expect, it } from "vitest";
import {
  demoStageProgress,
  nextDemoStage,
  parseDemoDetailMode,
  parseDemoStage,
} from "@/components/agentscope/demo-state";
import { buildDemoEvidenceViewModel } from "@/components/agentscope/demo-evidence-view-model";
import {
  buildProductDecisionBrief,
  serializeProductDecisionBrief,
} from "@/components/agentscope/product-decision-brief";
import { getRecordedCodeFixDemo } from "@/lib/agentscope/execution";
import { formatMessage, type Dictionary, type MessageKey } from "@/lib/i18n/config";
import en from "@/lib/i18n/dictionaries/en.json";
import zh from "@/lib/i18n/dictionaries/zh.json";

function translator(dictionary: Dictionary) {
  return (key: MessageKey, values?: Record<string, string | number>) =>
    formatMessage(dictionary[key], values);
}

describe("guided demo state", () => {
  it("falls back to intro and supports every shareable stage", () => {
    expect(parseDemoStage(new URLSearchParams())).toBe("intro");
    expect(parseDemoStage(new URLSearchParams("step=root-cause"))).toBe("root-cause");
    expect(parseDemoStage(new URLSearchParams("step=unknown"))).toBe("intro");
  });

  it("keeps the legacy verified URL compatible", () => {
    expect(parseDemoStage(new URLSearchParams("view=verified"))).toBe("verified");
  });

  it("supports mutually exclusive brief and trace detail modes", () => {
    expect(parseDemoDetailMode(new URLSearchParams())).toBe("summary");
    expect(parseDemoDetailMode(new URLSearchParams("details=brief"))).toBe("brief");
    expect(parseDemoDetailMode(new URLSearchParams("details=trace"))).toBe("trace");
    expect(parseDemoDetailMode(new URLSearchParams("details=unknown"))).toBe("summary");
  });

  it("advances through one decision at a time", () => {
    expect(nextDemoStage("intro")).toBe("failure");
    expect(nextDemoStage("failure")).toBe("root-cause");
    expect(nextDemoStage("root-cause")).toBe("fork");
    expect(nextDemoStage("fork")).toBe("verified");
    expect(nextDemoStage("verified")).toBeUndefined();
    expect(demoStageProgress("intro")).toBe(-1);
    expect(demoStageProgress("verified")).toBe(3);
  });
});

describe("guided demo evidence", () => {
  it("derives the story from the recorded parent and child", async () => {
    const view = buildDemoEvidenceViewModel(await getRecordedCodeFixDemo());
    expect(view.actionPath.map((span) => span.name)).toEqual([
      "read_file",
      "search_code",
      "apply_patch",
      "run_tests",
    ]);
    expect(view.repeatedSpans).toHaveLength(3);
    expect(view.forkSpanId).toBeTruthy();
    expect(view.comparison.parentFacts.errorCount).toBeGreaterThan(0);
    expect(view.comparison.childFacts.errorCount).toBe(0);
    expect(view.comparison.outcomes.regressed).toHaveLength(0);
  });

  it.each([
    ["en", en, "/demos/code-fix-loop"],
    ["zh", zh, "/zh/demos/code-fix-loop"],
  ] as const)("builds a complete %s product brief with shareable evidence", async (_locale, dictionary, path) => {
    const view = buildDemoEvidenceViewModel(await getRecordedCodeFixDemo());
    const t = translator(dictionary);
    const brief = buildProductDecisionBrief({
      view,
      t,
      evidenceBaseUrl: "https://agentscope.example/",
      localizedDemoPath: path,
    });

    expect(Object.values(brief).flat().every((value) => value.length > 0)).toBe(true);
    expect(brief.verification).toHaveLength(4);
    expect(brief.tradeoffs).toHaveLength(3);
    expect(brief.evidenceLinks).toHaveLength(3);
    expect(brief.evidenceLinks[0]).toContain(`${path}?step=verified&details=trace&runId=codefix_demo_parent`);
    expect(brief.evidenceLinks[2]).toContain("runId=codefix_demo_child");
    expect(brief.evidenceLinks.every((link) => link.includes("#codefix_demo_"))).toBe(true);

    const markdown = serializeProductDecisionBrief(brief, t);
    expect(markdown).toContain(`# ${dictionary["brief.title"]}`);
    expect(markdown).toContain(brief.rootCause);
    expect(markdown).toContain(brief.evidenceLinks[0]);
    expect(markdown).not.toContain("undefined");
  });
});
