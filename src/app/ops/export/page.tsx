"use client";

import { ExportSignupsTable } from "@/components/ops";

export default function ExportPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Export</h1>
        <p className="mt-2 text-slate-400">
          Build custom signup views and export filtered results.
        </p>
      </div>

      <ExportSignupsTable />
    </div>
  );
}
