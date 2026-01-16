"use client";

import { ReviewTable } from "@/components/ops";

export default function ReviewPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Review Queue</h1>
        <p className="mt-2 text-slate-400">
          Applications requiring ops approval for early departure.
        </p>
      </div>

      <ReviewTable />
    </div>
  );
}
