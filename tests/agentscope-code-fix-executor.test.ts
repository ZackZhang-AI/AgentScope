import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CodeFixRunExecutor,
  FixtureDecisionProvider,
  ToolRegistry,
  codeFixRunRequestSchema,
  type ToolAction,
  type ToolExecutionResult,
  type WorkspaceSandbox,
} from "../lib/agentscope/execution";
import { diagnoseRun } from "../lib/agentscope/diagnostics/diagnose-run";
import { evaluateRun } from "../lib/agentscope/eval/evaluate-run";
import { compareRuns } from "../lib/agentscope/compare/compare-runs";
import type { RunProjection } from "../lib/agentscope/domain";

class TestWorkspace implements WorkspaceSandbox {
  private files = {
    "src/auth.ts": "return session.userId === targetUserId;",
  };

  private hash() {
    return createHash("sha256")
      .update(JSON.stringify(this.files))
      .digest("hex")
      .slice(0, 16);
  }

  async execute(action: ToolAction): Promise<ToolExecutionResult> {
    const startedAt = Date.now();
    if (action.tool === "read_file") {
      return this.result(action.tool, "success", this.files["src/auth.ts"], startedAt);
    }
    if (action.tool === "search_code") {
      return this.result(action.tool, "success", ["src/auth.ts:1"], startedAt);
    }
    if (action.tool === "apply_patch") {
      const before = this.files["src/auth.ts"];
      this.files["src/auth.ts"] = before.replace(
        action.input.search,
        action.input.replacement,
      );
      return this.result(action.tool, "success", { changed: before !== this.files["src/auth.ts"] }, startedAt);
    }
    const passes = this.files["src/auth.ts"].includes('session.role === "admin"');
    return this.result(
      action.tool,
      passes ? "success" : "error",
      { passed: passes },
      startedAt,
      passes
        ? undefined
        : { code: "TEST_FAILED", message: "Admin test failed.", retryable: true },
    );
  }

  async snapshot() {
    const hash = this.hash();
    return { ref: `workspace://${hash}`, hash, files: { ...this.files } };
  }

  async dispose() {}

  private result(
    tool: ToolAction["tool"],
    status: ToolExecutionResult["status"],
    output: ToolExecutionResult["output"],
    startedAt: number,
    error?: ToolExecutionResult["error"],
  ): ToolExecutionResult {
    const workspaceHash = this.hash();
    return {
      tool,
      status,
      output,
      durationMs: Date.now() - startedAt,
      workspaceHash,
      progressHash: createHash("sha256")
        .update(JSON.stringify({ workspaceHash, output }))
        .digest("hex")
        .slice(0, 16),
      error,
    };
  }
}

describe("generic code-fix execution", () => {
  async function run(
    profile: "parent" | "repair",
    id: string,
    branch?: { parentRunId: string; forkedFromSpanId: string },
  ) {
    const executor = new CodeFixRunExecutor(new ToolRegistry(), () => id);
    let projection: RunProjection | undefined;
    for await (const message of executor.execute({
      request: {
        taskType: "code_fix",
        scenarioId: "buggy-auth-api",
        executionMode: "sandbox",
        decisionProvider: "fixture",
      },
      provider: new FixtureDecisionProvider(profile),
      workspace: new TestWorkspace(),
      branch,
    })) {
      if (message.type === "result") projection = message.result.trace;
    }
    if (!projection) throw new Error("Expected a code-fix projection.");
    return projection;
  }

  it("validates recorded runs as fixture-only", () => {
    expect(
      codeFixRunRequestSchema.safeParse({
        taskType: "code_fix",
        scenarioId: "buggy-auth-api",
        executionMode: "recorded",
        decisionProvider: "deepseek",
      }).success,
    ).toBe(false);
  });

  it("records nested model, tool and checkpoint events for a failed parent", async () => {
    const executor = new CodeFixRunExecutor(
      new ToolRegistry(),
      () => "codefix_parent_001",
    );
    const messages = [];

    for await (const message of executor.execute({
      request: {
        taskType: "code_fix",
        scenarioId: "buggy-auth-api",
        executionMode: "sandbox",
        decisionProvider: "fixture",
      },
      provider: new FixtureDecisionProvider("parent"),
      workspace: new TestWorkspace(),
    })) {
      messages.push(message);
    }

    const result = messages.find((message) => message.type === "result");
    expect(result?.type).toBe("result");
    if (result?.type !== "result") return;

    expect(result.result.trace.run.status).toBe("error");
    expect(
      result.result.trace.spans.filter((span) => span.kind === "model"),
    ).toHaveLength(7);
    expect(
      result.result.trace.spans.filter((span) => span.name === "run_tests"),
    ).toHaveLength(3);
    expect(result.result.trace.checkpoints).toHaveLength(7);
  });

  it("uses the repair profile to produce a successful child run", async () => {
    const executor = new CodeFixRunExecutor(
      new ToolRegistry(),
      () => "codefix_child_001",
    );
    const messages = [];

    for await (const message of executor.execute({
      request: {
        taskType: "code_fix",
        scenarioId: "buggy-auth-api",
        executionMode: "sandbox",
        decisionProvider: "fixture",
      },
      provider: new FixtureDecisionProvider("repair"),
      workspace: new TestWorkspace(),
      branch: {
        parentRunId: "codefix_parent_001",
        forkedFromSpanId: "codefix_parent_001:decision:4",
      },
    })) {
      messages.push(message);
    }

    const result = messages.find((message) => message.type === "result");
    expect(result?.type).toBe("result");
    if (result?.type !== "result") return;
    expect(result.result.trace.run.status).toBe("success");
    expect(result.result.trace.run.parentRunId).toBe("codefix_parent_001");
    expect(
      result.result.trace.spans.find((span) => span.name === "run_tests")?.status,
    ).toBe("success");
  });

  it("derives no-progress evidence, code-fix eval facts and resolved outcomes", async () => {
    const parent = await run("parent", "codefix_parent_analysis");
    const child = await run("repair", "codefix_child_analysis", {
      parentRunId: parent.run.id,
      forkedFromSpanId: `${parent.run.id}:decision:4`,
    });

    const diagnostics = diagnoseRun(parent);
    const parentEval = evaluateRun(parent);
    const childEval = evaluateRun(child);
    const comparison = compareRuns(parent, child);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "no-progress-loop",
          evidenceSpanIds: expect.arrayContaining([
            `${parent.run.id}:tool:4`,
            `${parent.run.id}:tool:6`,
          ]),
        }),
      ]),
    );
    expect(parentEval.measuredFacts.codeFix).toMatchObject({
      testPassed: false,
      noProgressCalls: 3,
    });
    expect(childEval.measuredFacts.codeFix).toMatchObject({
      testPassed: true,
      patchCreated: true,
      replaySafetyViolations: 0,
    });
    expect(comparison.outcomes.resolved).toEqual(
      expect.arrayContaining([
        expect.stringContaining("completed the task"),
        expect.stringContaining("duplicate tool loop"),
      ]),
    );
    expect(comparison.outcomes.regressed).toHaveLength(0);
  });
});
