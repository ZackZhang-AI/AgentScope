import { runMockAudit } from "../providers/mock";
import { evalCases, evalRules } from "./cases";

export async function runMockEvalSuite() {
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  const cases = [];

  for (const testCase of evalCases) {
    const result = await runMockAudit({
      content: testCase.content,
      inputType: testCase.inputType,
      provider: "mock",
      intensity: "standard",
      rules: evalRules,
    });
    const actual = new Set(result.findings.map((finding) => finding.category));
    const expected = new Set(testCase.expectedCategories);

    for (const category of actual) {
      if (expected.has(category)) truePositives += 1;
      else falsePositives += 1;
    }
    for (const category of expected) {
      if (!actual.has(category)) falseNegatives += 1;
    }

    cases.push({
      id: testCase.id,
      expected: [...expected],
      actual: [...actual],
      passed: [...expected].every((category) => actual.has(category)),
    });
  }

  const precision = truePositives / Math.max(1, truePositives + falsePositives);
  const recall = truePositives / Math.max(1, truePositives + falseNegatives);

  return {
    cases,
    precision,
    recall,
    passRate: cases.filter((testCase) => testCase.passed).length / cases.length,
  };
}
