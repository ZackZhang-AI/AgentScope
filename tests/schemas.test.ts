import { describe, expect, it } from "vitest";
import { auditRequestSchema } from "../lib/schemas";

describe("auditRequestSchema", () => {
  it("accepts a valid audit request", () => {
    const result = auditRequestSchema.safeParse({
      content: "diff --git a/app.ts b/app.ts",
      inputType: "diff",
      provider: "mock",
      intensity: "standard",
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = auditRequestSchema.safeParse({
      content: "   ",
      inputType: "diff",
      provider: "mock",
      intensity: "quick",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid provider and intensity values", () => {
    const result = auditRequestSchema.safeParse({
      content: "const ok = true;",
      inputType: "files",
      provider: "openai",
      intensity: "deep",
    });

    expect(result.success).toBe(false);
  });

  it("accepts MiniMax and rejects an empty rule selection", () => {
    const valid = auditRequestSchema.safeParse({
      content: "const ok = true;",
      inputType: "files",
      provider: "minimax",
      intensity: "standard",
      rules: ["security", "performance"],
    });
    const invalid = auditRequestSchema.safeParse({
      content: "const ok = true;",
      inputType: "files",
      provider: "mock",
      intensity: "standard",
      rules: [],
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("rejects oversized content", () => {
    const result = auditRequestSchema.safeParse({
      content: "a".repeat(60001),
      inputType: "files",
      provider: "mock",
      intensity: "standard",
    });

    expect(result.success).toBe(false);
  });
});
