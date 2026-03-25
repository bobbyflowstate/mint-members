"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const OPS_PASSWORD_KEY = "ops_password";

function getStatusClasses(status: string) {
  if (status === "accepted") {
    return "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30";
  }
  if (status === "denied") {
    return "bg-red-500/10 text-red-300 ring-red-400/30";
  }
  return "bg-amber-500/10 text-amber-300 ring-amber-400/30";
}

export function NewbieInvitesTable() {
  const [opsPassword] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(OPS_PASSWORD_KEY);
    }
    return null;
  });
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const [confirmingInvite, setConfirmingInvite] = useState<{
    inviteId: string;
    newbieEmail: string;
    sponsorName: string;
  } | null>(null);

  const invites = useQuery(api.newbieInvites.listForOps, opsPassword ? { opsPassword } : "skip");
  const setInviteDecision = useMutation(api.newbieInvites.setInviteDecision);
  const sendInviteApprovedEmail = useAction(api.newbieInvitesActions.sendInviteApprovedEmail);

  const handleAccept = async () => {
    if (!confirmingInvite || !opsPassword) {
      return;
    }

    setProcessingInviteId(confirmingInvite.inviteId);

    try {
      const result = await setInviteDecision({
        inviteId: confirmingInvite.inviteId as never,
        accepted: true,
        opsPassword,
      });

      if (result.shouldSendApprovalEmail) {
        await sendInviteApprovedEmail({
          inviteId: confirmingInvite.inviteId as never,
          newbieEmail: confirmingInvite.newbieEmail,
          sponsorName: confirmingInvite.sponsorName,
        });
      }
    } finally {
      setProcessingInviteId(null);
      setConfirmingInvite(null);
    }
  };

  const handleDeny = async (inviteId: string) => {
    if (!opsPassword) {
      return;
    }

    setProcessingInviteId(inviteId);
    try {
      await setInviteDecision({
        inviteId: inviteId as never,
        accepted: false,
        opsPassword,
      });
    } finally {
      setProcessingInviteId(null);
    }
  };

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
    <>
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1360px] divide-y divide-white/10">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Sponsor</th>
                <th className="px-4 py-3">Newbie</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Estimated Arrival</th>
                <th className="px-4 py-3">Estimated Departure</th>
                <th className="px-4 py-3">Why They Belong</th>
                <th className="px-4 py-3">Acknowledged</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-slate-200">
              {invites.map((invite) => {
                const isProcessing = processingInviteId === invite._id;
                const denyDisabled = isProcessing || Boolean(invite.applicationId);

                return (
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
                    <td className="px-4 py-3 whitespace-nowrap">{invite.estimatedArrival ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{invite.estimatedDeparture ?? "—"}</td>
                    <td className="px-4 py-3 max-w-sm whitespace-pre-wrap">{invite.whyTheyBelong}</td>
                    <td className="px-4 py-3">{invite.preparednessAcknowledged ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${getStatusClasses(invite.status)}`}
                      >
                        {invite.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() =>
                            setConfirmingInvite({
                              inviteId: invite._id,
                              newbieEmail: invite.newbieEmail,
                              sponsorName: invite.sponsorName,
                            })
                          }
                          className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={denyDisabled}
                          onClick={() => {
                            void handleDeny(invite._id);
                          }}
                          className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          Deny
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                      {new Date(invite.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirmingInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-slate-900 p-6 ring-1 ring-white/10">
            <h3 className="text-lg font-semibold text-white">Confirm Accept</h3>
            <p className="mt-3 text-sm text-slate-300">
              Are you sure? This will send the newbie an email letting them know they can apply.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmingInvite(null)}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleAccept();
                }}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
