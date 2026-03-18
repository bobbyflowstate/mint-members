"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const OPS_PASSWORD_KEY = "ops_password";

export function NewbieInvitesTable() {
  const [opsPassword] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(OPS_PASSWORD_KEY);
    }
    return null;
  });

  const invites = useQuery(
    api.newbieInvites.listForOps,
    opsPassword ? { opsPassword } : "skip"
  );

  if (!opsPassword || invites === undefined) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-slate-400">Loading newbie invites...</p>
      </div>
    );
  }

  if (invites.length === 0) {
    return (
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-6">
        <p className="text-slate-400">No newbie invites yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[1080px] divide-y divide-white/10">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Sponsor</th>
              <th className="px-4 py-3">Newbie</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Why They Belong</th>
              <th className="px-4 py-3">Acknowledged</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm text-slate-200">
            {invites.map((invite) => (
              <tr key={invite._id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{invite.sponsorName}</div>
                  <div className="text-xs text-slate-400">{invite.sponsorEmail}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{invite.newbieName}</div>
                  <div className="text-xs text-slate-400">{invite.newbieEmail}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{invite.newbiePhone}</td>
                <td className="px-4 py-3 max-w-sm whitespace-pre-wrap">{invite.whyTheyBelong}</td>
                <td className="px-4 py-3">{invite.preparednessAcknowledged ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/30">
                    {invite.derivedStatus}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                  {new Date(invite.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
