import { samples } from "../samples";
import type { AuditRule, Finding } from "../types";

export type EvalCase = {
  id: string;
  content: string;
  inputType: "diff" | "files";
  expectedCategories: Finding["category"][];
};

export const evalRules: AuditRule[] = [
  "security",
  "reliability",
  "testing",
  "maintainability",
];

export const evalCases: EvalCase[] = [
  {
    id: "authorization-regression",
    content: samples.reactAuthBug.content,
    inputType: samples.reactAuthBug.inputType,
    expectedCategories: ["security", "testing"],
  },
  {
    id: "missing-api-validation-tests",
    content: samples.apiValidationBug.content,
    inputType: samples.apiValidationBug.inputType,
    expectedCategories: ["testing"],
  },
  {
    id: "sql-injection",
    content: samples.sqlInjectionRisk.content,
    inputType: samples.sqlInjectionRisk.inputType,
    expectedCategories: ["security", "testing"],
  },
];
