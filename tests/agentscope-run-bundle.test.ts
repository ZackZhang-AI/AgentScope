import { describe, expect, it } from "vitest";
import successfulFixture from "../fixtures/agentscope/successful-code-audit.json";
import {
  projectTraceEvents,
  traceFixtureSchema,
} from "../lib/agentscope/domain";
import {
  createRunBundle,
  parseRunBundle,
} from "../lib/agentscope/transfer/run-bundle";

describe("AgentScope versioned run bundle", () => {
  it("round-trips immutable events, projection, and versioned analyses", () => {
    const fixture = traceFixtureSchema.parse(successfulFixture);
    const projection = projectTraceEvents(fixture.events);
    const bundle = createRunBundle(
      projection,
      fixture.events,
      "2026-07-28T12:00:00.000Z",
    );
    const imported = parseRunBundle(JSON.parse(JSON.stringify(bundle)));

    expect(imported).toEqual(bundle);
    expect(imported.bundleVersion).toBe(1);
    expect(imported.source).toBe("event_stream");
    expect(imported.analyses.map((analysis) => analysis.type)).toEqual([
      "diagnostics",
      "eval",
    ]);
    expect(
      imported.analyses.find((analysis) => analysis.type === "eval")?.payload
        .reportSchemaVersion,
    ).toBe(1);
  });

  it("exports an honest projection snapshot when raw events are unavailable", () => {
    const fixture = traceFixtureSchema.parse(successfulFixture);
    const bundle = createRunBundle(
      projectTraceEvents(fixture.events),
      [],
      "2026-07-28T12:00:00.000Z",
    );

    expect(bundle.source).toBe("projection_snapshot");
    expect(bundle.events).toEqual([]);
    expect(bundle.limitations).toHaveLength(1);
    expect(parseRunBundle(bundle).projection.run.id).toBe("run_success_001");
  });

  it("rejects a projection tampered independently of its event stream", () => {
    const fixture = traceFixtureSchema.parse(successfulFixture);
    const bundle = createRunBundle(
      projectTraceEvents(fixture.events),
      fixture.events,
      "2026-07-28T12:00:00.000Z",
    );
    const tampered = structuredClone(bundle);
    tampered.projection.run.name = "tampered";

    expect(() => parseRunBundle(tampered)).toThrow(
      "Bundle projection does not match its immutable event stream.",
    );
  });
});
