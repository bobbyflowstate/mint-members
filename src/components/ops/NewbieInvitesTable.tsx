"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { requiresOpsReview } from "../../config/content";

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
  const [actionMenuInviteId, setActionMenuInviteId] = useState<string | null>(null);
  const [confirmingInvite, setConfirmingInvite] = useState<{
    inviteId: string;
    newbieEmail: string;
    sponsorName: string;
  } | null>(null);

  const invites = useQuery(api.newbieInvites.listForOps, opsPassword ? { opsPassword } : "skip");
  const config = useQuery(api.config.getConfig);
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
      setActionMenuInviteId(null);
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
      setActionMenuInviteId(null);
    }
  };

  if (!opsPassword || invites === undefined || config === undefined) {
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
      <div className="space-y-4">
        {invites.map((invite) => {
          const isProcessing = processingInviteId === invite._id;
          const denyDisabled = isProcessing || Boolean(invite.applicationId);
          const estimatedDeparture = invite.estimatedDeparture;
          const isEarlyDeparture = estimatedDeparture
            ? requiresOpsReview(estimatedDeparture, config.departureCutoff)
            : false;
          const isDecided = invite.status === "accepted" || invite.status === "denied";
          const isActionMenuOpen = actionMenuInviteId === invite._id;

          return (
            <article
              key={invite._id}
              className={`rounded-2xl border p-5 shadow-sm ring-1 ${
                "border-white/10 bg-white/5 ring-white/10"
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Newbie
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-white">{invite.newbieName}</h2>
                      <p className="text-sm text-slate-300">{invite.newbieEmail}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ${getStatusClasses(invite.status)}`}
                      >
                        {invite.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl bg-slate-950/40 p-3 ring-1 ring-white/5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Sponsor
                      </p>
                      <p className="mt-2 font-medium text-white">{invite.sponsorName}</p>
                      <p className="text-sm text-slate-400">{invite.sponsorEmail}</p>
                    </div>
                    <div className="rounded-xl bg-slate-950/40 p-3 ring-1 ring-white/5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Phone
                      </p>
                      <p className="mt-2 font-medium text-white">{invite.newbiePhone}</p>
                    </div>
                    <div className="rounded-xl bg-slate-950/40 p-3 ring-1 ring-white/5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Created
                      </p>
                      <p className="mt-2 font-medium text-white">
                        {new Date(invite.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <section className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-white/5">
                    <h3 className="text-sm font-semibold text-white">Invite details</h3>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Estimated arrival
                        </dt>
                        <dd className="mt-1 text-sm text-slate-200">
                          {invite.estimatedArrival ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Estimated departure
                        </dt>
                        <dd
                          className={`mt-1 text-sm ${
                            isEarlyDeparture ? "font-medium text-amber-200" : "text-slate-200"
                          }`}
                        >
                          {invite.estimatedDeparture ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Preparedness acknowledged
                        </dt>
                        <dd className="mt-1 text-sm text-slate-200">
                          {invite.preparednessAcknowledged ? "Yes" : "No"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Application
                        </dt>
                        <dd className="mt-1 text-sm text-slate-200">
                          {invite.applicationId ? "Started" : "Not started"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <div className="grid gap-3 xl:grid-cols-2">
                    <section className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-white/5">
                      <h3 className="text-sm font-semibold text-white">Why they belong</h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {invite.whyTheyBelong}
                      </p>
                    </section>

                    <section
                      className={`rounded-2xl p-4 ring-1 ${
                        isEarlyDeparture
                          ? "bg-amber-500/10 ring-amber-300/20"
                          : "bg-slate-950/40 ring-white/5"
                      }`}
                    >
                      <h3 className="text-sm font-semibold text-white">Early departure reason</h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {invite.earlyDepartureReason ?? "—"}
                      </p>
                    </section>
                  </div>
                </div>

                {isDecided ? (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      aria-expanded={isActionMenuOpen}
                      onClick={() =>
                        setActionMenuInviteId((currentId) =>
                          currentId === invite._id ? null : invite._id
                        )
                      }
                      className="rounded-lg bg-white/8 px-4 py-2 text-sm font-medium text-slate-100 ring-1 ring-white/10 hover:bg-white/12"
                    >
                      Change
                    </button>
                    {isActionMenuOpen && (
                      <div className="absolute right-0 z-10 mt-2 flex min-w-40 flex-col gap-2 rounded-xl bg-slate-950 p-2 shadow-2xl ring-1 ring-white/10">
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
                          className="rounded-lg bg-emerald-500/20 px-4 py-2 text-left text-sm font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={denyDisabled}
                          onClick={() => {
                            void handleDeny(invite._id);
                          }}
                          className="rounded-lg bg-red-500/20 px-4 py-2 text-left text-sm font-medium text-red-300 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex shrink-0 gap-2 lg:flex-col">
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
                      className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={denyDisabled}
                      onClick={() => {
                        void handleDeny(invite._id);
                      }}
                      className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    >
                      Deny
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
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
