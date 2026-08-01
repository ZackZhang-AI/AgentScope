import { describe, expect, it } from "vitest";
import failedFixture from "../fixtures/agentscope/failed-repeated-tool.json";
import forkedFixture from "../fixtures/agentscope/forked-successful-code-audit.json";
import successfulFixture from "../fixtures/agentscope/successful-code-audit.json";
import {
  assertRunTransition,
  assertSpanTransition,
  projectTraceEvents,
  runSchema,
  traceFixtureSchema,
  TraceProjectionError,
} from "../lib/agentscope/domain";
import { TraceRecorder } from "../lib/agentscope/application/trace-recorder";

describe("AgentScope trace fixtures", () => {
  it.each([
    ["successful run", successfulFixture],
    ["failed repeated tool run", failedFixture],
    ["successful fork", forkedFixture],
  ])("validates the %s fixture", (_name, fixture) => {
    expect(traceFixtureSchema.safeParse(fixture).success).toBe(true);
  });

  it("projects a successful nested trace without losing repeated kinds", () => {
    const projection = projectTraceEvents(successfulFixture.events);

    expect(projection.run.status).toBe("success");
    expect(projection.run.rootSpanId).toBe("span_success_root");
    expect(projection.spans).toHaveLength(5);
    expect(projection.artifacts).toHaveLength(1);
    expect(projection.checkpoints).toHaveLength(1);
    expect(projection.lastSequence).toBe(15);
    expect(projection.dataQualityIssues).toEqual([]);
    expect(
      projection.spans.find((span) => span.id === "span_success_tool")
        ?.parentSpanId,
    ).toBe("span_success_model");
  });

  it("preserves all identical failed tool calls as separate spans", () => {
    const projection = projectTraceEvents(failedFixture.events);
    const failedTools = projection.spans.filter(
      (span) => span.kind === "tool" && span.status === "error",
    );

    expect(projection.run.status).toBe("error");
    expect(failedTools.map((span) => span.id)).toEqual([
      "span_failure_tool_1",
      "span_failure_tool_2",
      "span_failure_tool_3",
    ]);
    expect(
      failedTools.map((span) => span.inputRef).every((input) => {
        return input?.kind === "inline";
      }),
    ).toBe(true);
  });

  it("keeps immutable branch provenance on a forked run", () => {
    const projection = projectTraceEvents(forkedFixture.events);

    expect(projection.run.status).toBe("success");
    expect(projection.run.parentRunId).toBe("run_failure_001");
    expect(projection.run.forkedFromSpanId).toBe("span_failure_tool_1");
    expect(projection.run.taskInputHash).toBe("2222222222222222");
  });
});

describe("AgentScope state machines", () => {
  it("allows only forward run transitions", () => {
    expect(() => assertRunTransition("queued", "running")).not.toThrow();
    expect(() => assertRunTransition("running", "success")).not.toThrow();
    expect(() => assertRunTransition("success", "running")).toThrow(
      /Invalid run status transition/,
    );
  });

  it("allows a running span to end exactly once", () => {
    expect(() => assertSpanTransition("running", "error")).not.toThrow();
    expect(() => assertSpanTransition("error", "success")).toThrow(
      /Invalid span status transition/,
    );
  });

  it("requires complete fork provenance", () => {
    const baseRun = successfulFixture.events[0].payload.run;
    const result = runSchema.safeParse({
      ...baseRun,
      parentRunId: "run_parent",
    });

    expect(result.success).toBe(false);
  });
});

describe("AgentScope trace projection invariants", () => {
  it("rejects a child span that starts before its parent", () => {
    const events = traceFixtureSchema.parse(
      structuredClone(successfulFixture),
    ).events;
    const childStart = events[3];

    if (childStart.type !== "span.started") {
      throw new Error("Fixture no longer contains the expected child span.");
    }

    childStart.payload.span.parentSpanId = "span_unknown";

    expect(() => projectTraceEvents(events)).toThrow(TraceProjectionError);
    expect(() => projectTraceEvents(events)).toThrow(/has not started/);
  });

  it("rejects duplicate event identifiers", () => {
    const events = structuredClone(successfulFixture.events);
    events[1].eventId = events[0].eventId;

    expect(() => projectTraceEvents(events)).toThrow(/Duplicate eventId/);
  });

  it("reports spans left open when a run terminates", () => {
    const events = structuredClone(successfulFixture.events).filter(
      (event) => event.eventId !== "evt_success_014",
    );
    const projection = projectTraceEvents(events);

    expect(projection.dataQualityIssues).toContainEqual({
      code: "unclosed_span",
      message: "Span span_success_root was still running when the run ended.",
      spanId: "span_success_root",
    });
  });
});

describe("TraceRecorder", () => {
  it("records a valid nested run with monotonic events", () => {
    const createdRun = traceFixtureSchema.parse(successfulFixture).events[0];
    if (createdRun.type !== "run.created") {
      throw new Error("Fixture no longer starts with run.created.");
    }

    const recorder = new TraceRecorder(
      {
        ...createdRun.payload.run,
        id: "run_recorder_001",
        name: "Recorder test",
        createdAt: "2026-07-28T04:00:00.000Z",
      },
      () => "2026-07-28T04:00:00.001Z",
    );

    recorder.startRun();
    recorder.startSpan({
      id: "span_recorder_root",
      kind: "agent",
      name: "test-agent",
    });
    recorder.startSpan({
      id: "span_recorder_tool",
      parentSpanId: "span_recorder_root",
      kind: "tool",
      name: "read_file",
      inputRef: {
        kind: "inline",
        data: { path: "app.ts" },
        redacted: false,
      },
    });
    recorder.endSpan("span_recorder_tool", {
      status: "success",
      outputRef: {
        kind: "inline",
        data: { lines: 20 },
        redacted: false,
      },
    });
    recorder.endSpan("span_recorder_root", { status: "success" });
    recorder.endRun("success");

    const projection = recorder.project();

    expect(recorder.events.map((event) => event.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(new Set(recorder.events.map((event) => event.eventId)).size).toBe(7);
    expect(projection.run.status).toBe("success");
    expect(projection.spans).toHaveLength(2);
  });

  it("prevents ending a span twice", () => {
    const createdRun = traceFixtureSchema.parse(successfulFixture).events[0];
    if (createdRun.type !== "run.created") {
      throw new Error("Fixture no longer starts with run.created.");
    }

    const recorder = new TraceRecorder({
      ...createdRun.payload.run,
      id: "run_recorder_002",
      name: "Recorder transition test",
    });
    recorder.startRun();
    recorder.startSpan({
      id: "span_recorder_once",
      kind: "agent",
      name: "test-agent",
    });
    recorder.endSpan("span_recorder_once", { status: "success" });

    expect(() =>
      recorder.endSpan("span_recorder_once", { status: "success" }),
    ).toThrow(/Invalid span status transition/);
  });
});
