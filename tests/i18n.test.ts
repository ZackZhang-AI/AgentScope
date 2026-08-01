import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/dictionaries/en.json";
import zh from "@/lib/i18n/dictionaries/zh.json";
import { formatMessage, localizedPath } from "@/lib/i18n/config";

describe("AgentScope i18n", () => {
  it("keeps English and Chinese dictionary keys complete and non-empty", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    expect(Object.values(en).every((value) => value.trim().length > 0)).toBe(true);
    expect(Object.values(zh).every((value) => value.trim().length > 0)).toBe(true);
  });

  it("preserves dynamic Run paths, queries and hashes while switching locale", () => {
    const path = "/runs/run-123?view=verified#span-tool-test-2";
    expect(localizedPath(path, "zh")).toBe(
      "/zh/runs/run-123?view=verified#span-tool-test-2",
    );
    expect(localizedPath(`/zh${path}`, "en")).toBe(path);
    expect(localizedPath(`/en${path}`, "zh")).toBe(
      "/zh/runs/run-123?view=verified#span-tool-test-2",
    );
  });

  it("interpolates known values without hiding unknown evidence placeholders", () => {
    expect(formatMessage("Span {spanId}: {status}", { spanId: "span-1" })).toBe(
      "Span span-1: {status}",
    );
  });
});
