import { Check, Circle } from "lucide-react";

const steps = [
  { id: "failure", label: "Failure", detail: "Parent repeats a failing test." },
  { id: "root-cause", label: "Root cause", detail: "No workspace progress is detected." },
  { id: "fork", label: "Fork", detail: "A safe checkpoint restores state." },
  { id: "verified", label: "Verified fix", detail: "Child tests pass with evidence." },
] as const;

type DemoProgressProps = {
  current: number;
};

export function DemoProgress({ current }: DemoProgressProps) {
  return (
    <nav
      className="border-b border-zinc-200 bg-zinc-950 text-white"
      aria-label="Code-fix demonstration progress"
    >
      <ol className="mx-auto grid max-w-[1800px] grid-cols-2 px-4 sm:grid-cols-4 lg:px-6">
        {steps.map((step, index) => {
          const complete = index < current;
          const active = index === current;
          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className={`flex gap-2 border-zinc-800 px-2 py-3 sm:border-r sm:last:border-r-0 ${
                active ? "bg-zinc-900" : ""
              }`}
            >
              {complete ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
              ) : (
                <Circle
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    active ? "text-emerald-400" : "text-zinc-600"
                  }`}
                  aria-hidden="true"
                />
              )}
              <span>
                <span className="block text-xs font-semibold">{step.label}</span>
                <span className="mt-0.5 hidden text-[10px] leading-4 text-zinc-400 lg:block">
                  {step.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
