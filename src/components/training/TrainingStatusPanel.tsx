import Link from "next/link";
import {
  STATUS_LABELS,
  trainingHeadline,
  type ModuleStatus,
  type TrainingSummary,
} from "@/lib/training/status";

const STATUS_PILL: Record<ModuleStatus, string> = {
  complete: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  in_progress: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
  not_started: "bg-white/5 text-slate-400 ring-white/10",
};

/** Presentation only — see TrainingDashboardCard for the data-fetching wrapper. */
export function TrainingStatusPanel({ summary }: { summary: TrainingSummary }) {
  const { entries, allComplete, minutesOutstanding } = summary;

  return (
    <section
      className={`rounded-2xl p-5 ring-1 ${
        allComplete ? "bg-emerald-400/5 ring-emerald-400/20" : "bg-amber-400/10 ring-amber-400/30"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${
              allComplete ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            {allComplete ? "Training complete" : "Required training"}
          </p>
          <h2 className="mt-1 font-semibold text-white">{trainingHeadline(summary)}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {allComplete
              ? "Your completions are on file. Open a module any time to re-read it."
              : `About ${minutesOutstanding} minutes, and it's required before you camp with us.`}
          </p>
        </div>
        <Link
          href="/training"
          className={`shrink-0 text-sm font-semibold ${
            allComplete ? "text-emerald-300 hover:text-emerald-200" : "text-amber-300 hover:text-amber-200"
          }`}
        >
          All training →
        </Link>
      </div>

      <ul className="mt-4 space-y-2">
        {entries.map(({ module, status }) => (
          <li key={module.slug}>
            <Link
              href={`/training/${module.slug}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10 transition-colors hover:bg-white/10"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{module.title}</span>
                <span className="text-xs text-slate-400">{module.estimatedMinutes} min</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS_PILL[status]}`}
                >
                  {STATUS_LABELS[status]}
                </span>
                <span aria-hidden="true" className="text-sm text-slate-500">
                  →
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
