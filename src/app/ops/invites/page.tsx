"use client";

import { NewbieInvitesTable } from "@/components/ops/NewbieInvitesTable";

export default function OpsInvitesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Newbie Invites</h1>
        <p className="mt-2 text-slate-400">
          Review newbie invite submissions and accept or deny access to apply.
        </p>
      </div>

      <NewbieInvitesTable />
    </div>
  );
}
