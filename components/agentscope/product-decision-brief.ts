import type { Locale, MessageKey } from "@/lib/i18n/config";
import type { DemoEvidenceViewModel } from "./demo-evidence-view-model";

type Translator = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string;

export type ProductDecisionBrief = {
  task: string;
  failure: string;
  rootCause: string;
  recoveryDecision: string;
  verification: string[];
  tradeoffs: string[];
  evidenceLinks: string[];
  limitations: string[];
};

type BuildProductDecisionBriefOptions = {
  view: DemoEvidenceViewModel;
  t: Translator;
  evidenceBaseUrl: string;
  localizedDemoPath: string;
};

function evidenceUrl(
  baseUrl: string,
  localizedDemoPath: string,
  runId: string,
  spanId: string | undefined,
) {
  if (!spanId) return undefined;
  const url = new URL(localizedDemoPath, baseUrl);
  url.searchParams.delete("view");
  url.searchParams.set("step", "verified");
  url.searchParams.set("details", "trace");
  url.searchParams.set("runId", runId);
  url.hash = spanId;
  return url.toString();
}

export function buildProductDecisionBrief({
  view,
  t,
  evidenceBaseUrl,
  localizedDemoPath,
}: BuildProductDecisionBriefOptions): ProductDecisionBrief {
  const { parentFacts, childFacts, outcomes } = view.comparison;
  const verifiedTest = view.child.spans.find(
    (span) => span.kind === "tool" && span.name === "run_tests" && span.status === "success",
  );
  const links = [
    evidenceUrl(evidenceBaseUrl, localizedDemoPath, view.parent.run.id, view.firstFailureSpan?.id),
    evidenceUrl(evidenceBaseUrl, localizedDemoPath, view.parent.run.id, (view.repeatedSpans[1] ?? view.repeatedSpans[0])?.id),
    evidenceUrl(evidenceBaseUrl, localizedDemoPath, view.child.run.id, verifiedTest?.id),
  ].filter((link): link is string => Boolean(link));

  return {
    task: t("brief.task"),
    failure: t("brief.failure"),
    rootCause: t("brief.rootCause"),
    recoveryDecision: t("brief.recoveryDecision"),
    verification: [
      t("brief.verification.test"),
      t("brief.verification.errors", {
        before: parentFacts.errorCount,
        after: childFacts.errorCount,
      }),
      t("brief.verification.repeats", {
        before: parentFacts.duplicateToolCalls,
        after: childFacts.duplicateToolCalls,
      }),
      outcomes.regressed.length === 0
        ? t("brief.verification.noRegression")
        : t("brief.verification.regression", { count: outcomes.regressed.length }),
    ],
    tradeoffs: [
      t("brief.tradeoff.tokens", {
        before: parentFacts.totalTokens ?? t("brief.notReported"),
        after: childFacts.totalTokens ?? t("brief.notReported"),
      }),
      t("brief.tradeoff.latency", {
        before: parentFacts.durationMs,
        after: childFacts.durationMs,
      }),
      t("brief.tradeoff.tools", {
        before: parentFacts.toolCalls,
        after: childFacts.toolCalls,
      }),
    ],
    evidenceLinks: links,
    limitations: [
      t("brief.limitation.recorded"),
      t("brief.limitation.deterministic"),
      t("brief.limitation.scope"),
    ],
  };
}

export function serializeProductDecisionBrief(
  brief: ProductDecisionBrief,
  t: Translator,
) {
  const sections = [
    `# ${t("brief.title")}`,
    t("brief.subtitle"),
    `## ${t("brief.section.task")}\n\n${brief.task}`,
    `## ${t("brief.section.failure")}\n\n${brief.failure}`,
    `## ${t("brief.section.rootCause")}\n\n${brief.rootCause}`,
    `## ${t("brief.section.decision")}\n\n${brief.recoveryDecision}`,
    `## ${t("brief.section.verification")}\n\n${brief.verification.map((item) => `- ${item}`).join("\n")}`,
    `## ${t("brief.section.tradeoffs")}\n\n${brief.tradeoffs.map((item) => `- ${item}`).join("\n")}`,
    `## ${t("brief.section.evidence")}\n\n${brief.evidenceLinks.map((url, index) => `- [${t(`brief.evidence.${index + 1}` as "brief.evidence.1")}](${url})`).join("\n")}`,
    `## ${t("brief.section.limitations")}\n\n${brief.limitations.map((item) => `- ${item}`).join("\n")}`,
  ];
  return `${sections.join("\n\n")}\n`;
}

export function productDecisionBriefFilename(locale: Locale) {
  return `agentscope-code-fix-brief-${locale}.md`;
}
