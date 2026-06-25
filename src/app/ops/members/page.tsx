"use client";

import { MembersTable } from "@/components/ops/MembersTable";

export default function MembersPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Members</h1>
        <p className="mt-2 text-slate-400">
          All signups with attendance details, logistics, and export.
        </p>
      </div>

      <MembersTable />
    </div>
  );
}
