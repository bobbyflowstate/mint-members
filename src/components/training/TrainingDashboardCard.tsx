"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { trainingModules } from "@/lib/training/modules";

export function TrainingDashboardCard() {
  const records = useQuery(api.training.listMine);
  if (records === undefined) return <div className="h-24 animate-pulse rounded-2xl bg-white/5" />;

  const required = trainingModules.filter((module) => module.required);
  const completed = required.filter((module) => records.some((record) =>
    record.moduleSlug === module.slug && record.completedAt &&
    module.completionPolicy.acceptedVersions.includes(record.moduleVersion)
  )).length;
  const complete = completed === required.length;
  const totalMinutes = required.reduce((sum, module) => sum + module.estimatedMinutes, 0);

  return <Link href="/training" className={`flex items-center justify-between gap-5 rounded-2xl p-5 ring-1 transition-colors ${complete ? "bg-emerald-400/10 ring-emerald-400/30 hover:bg-emerald-400/15" : "bg-amber-400/10 ring-amber-400/30 hover:bg-amber-400/15"}`}>
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide ${complete ? "text-emerald-300" : "text-amber-300"}`}>{complete ? "Training complete" : "Required training"}</p>
      <h2 className="mt-1 font-semibold text-white">{required.length} required modules · {totalMinutes} minutes</h2>
      <p className="mt-1 text-sm text-slate-400">{complete ? "Your current module completions are on file." : `${completed} of ${required.length} required modules complete.`}</p>
    </div>
    <span className={`shrink-0 text-sm font-semibold ${complete ? "text-emerald-300" : "text-amber-300"}`}>{complete ? "Review training →" : "Start training →"}</span>
  </Link>;
}
