"use client";

import { EventLogTable } from "@/components/ops";

export default function LogsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Event Logs</h1>
        <p className="mt-2 text-slate-400">
          Audit trail of all application and payment events.
        </p>
      </div>

      <EventLogTable />
    </div>
  );
}
