import { Check, Circle, LockKeyhole } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export const demoSteps = [
  { id: "failure", labelKey: "demo.failure", detailKey: "demo.failureDetail" },
  { id: "root-cause", labelKey: "demo.rootCause", detailKey: "demo.rootCauseDetail" },
  { id: "fork", labelKey: "demo.fork", detailKey: "demo.forkDetail" },
  { id: "verified", labelKey: "demo.verified", detailKey: "demo.verifiedDetail" },
] as const;

export type DemoStepId = (typeof demoSteps)[number]["id"];

type DemoProgressProps = {
  current: DemoStepId;
  available: DemoStepId[];
  onSelect: (step: DemoStepId) => void;
};

export function DemoProgress({ current, available, onSelect }: DemoProgressProps) {
  const { t } = useI18n();
  const currentIndex = demoSteps.findIndex((step) => step.id === current);
  return (
    <nav
      className="border-b border-zinc-200 bg-zinc-950 text-white"
      aria-label={t("demo.progressLabel")}
    >
      <ol className="mx-auto grid max-w-[1800px] grid-cols-2 px-4 sm:grid-cols-4 lg:px-6">
        {demoSteps.map((step, index) => {
          const label = t(step.labelKey);
          const detail = t(step.detailKey);
          const complete = index < currentIndex;
          const active = step.id === current;
          const enabled = available.includes(step.id);
          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className={`border-zinc-800 sm:border-r sm:last:border-r-0 ${
                active ? "bg-zinc-900" : ""
              }`}
            >
              <button
                type="button"
                disabled={!enabled}
                onClick={() => onSelect(step.id)}
                className="flex h-full w-full gap-2 px-2 py-3 text-left disabled:cursor-not-allowed disabled:opacity-55"
                aria-label={`${label}: ${detail}`}
              >
                {complete ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                ) : enabled ? (
                  <Circle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      active ? "text-emerald-400" : "text-zinc-500"
                    }`}
                    aria-hidden="true"
                  />
                ) : (
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />
                )}
                <span>
                  <span className="block text-xs font-semibold">{label}</span>
                  <span className="mt-0.5 hidden text-[10px] leading-4 text-zinc-400 lg:block">
                    {detail}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
