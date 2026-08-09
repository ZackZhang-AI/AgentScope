import { describe, expect, it } from "vitest";
import {
  demoStageProgress,
  nextDemoStage,
  parseDemoStage,
} from "@/components/agentscope/demo-state";
import { buildDemoEvidenceViewModel } from "@/components/agentscope/demo-evidence-view-model";
import { getRecordedCodeFixDemo } from "@/lib/agentscope/execution";

describe("guided demo state", () => {
  it("falls back to intro and supports every shareable stage", () => {
    expect(parseDemoStage(new URLSearchParams())).toBe("intro");
    expect(parseDemoStage(new URLSearchParams("step=root-cause"))).toBe("root-cause");
    expect(parseDemoStage(new URLSearchParams("step=unknown"))).toBe("intro");
  });

  it("keeps the legacy verified URL compatible", () => {
    expect(parseDemoStage(new URLSearchParams("view=verified"))).toBe("verified");
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
});
