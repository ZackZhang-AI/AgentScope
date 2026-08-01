import { describe, expect, it } from "vitest";
import { runMockEvalSuite } from "../lib/evals/suite";

describe("reproducible mock eval suite", () => {
  it("detects every expected category without category-level false positives", async () => {
    const result = await runMockEvalSuite();

    expect(result.passRate).toBe(1);
    expect(result.precision).toBe(1);
    expect(result.recall).toBe(1);
  });
});
