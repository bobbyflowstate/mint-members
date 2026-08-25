"use client";

import { TrainingTable } from "@/components/ops/TrainingTable";

export default function OpsTrainingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Training</h1>
        <p className="mt-2 text-slate-400">
          Where every active member stands on the required training modules,
          and a CSV export for chasing the stragglers.
        </p>
      </div>

      <TrainingTable />
    </div>
  );
}
