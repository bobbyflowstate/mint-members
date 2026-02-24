"use client";

import { ConfirmedMembersTable } from "@/components/ops";

export default function ConfirmedMembersPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Confirmed Members</h1>
        <p className="mt-2 text-slate-400">
          Confirmed members with attendance details and logistics requests.
        </p>
      </div>

      <ConfirmedMembersTable />
    </div>
  );
}
