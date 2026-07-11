"use client";

import { ProfileCompleteness } from "@/lib/attendeeProfile/completeness";

export function CompletenessSummary({
  completeness,
}: {
  completeness: ProfileCompleteness;
}) {
  const { sections, completeCount, totalCount } = completeness;
  const allDone = completeCount === totalCount;

  return (
    <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-5 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-white">
          {allDone
            ? "Profile complete — thank you!"
            : `${completeCount} of ${totalCount} sections complete`}
        </p>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(completeCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {!allDone && (
        <ul className="mt-3 space-y-1">
          {sections
            .filter((section) => !section.complete)
            .map((section) => (
              <li key={section.key} className="text-xs text-slate-400">
                <span className="text-amber-300">{section.label}:</span>{" "}
                {section.missing.join(", ")}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
