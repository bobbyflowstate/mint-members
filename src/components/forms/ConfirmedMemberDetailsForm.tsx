"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { canonicalizePhoneInput, formatPhoneDisplay } from "../../lib/phone/format";
import { isValidE164Phone } from "../../lib/applications/validation";

function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  let message = error.message.trim();

  const uncaughtPrefix = "Uncaught Error:";
  const uncaughtIndex = message.indexOf(uncaughtPrefix);
  if (uncaughtIndex >= 0) {
    message = message.slice(uncaughtIndex + uncaughtPrefix.length).trim();
  }

  const handlerIndex = message.indexOf(" at handler");
  if (handlerIndex >= 0) {
    message = message.slice(0, handlerIndex).trim();
  }

  if (message.includes("Newbie phone must be in E.164 format")) {
    return "Please enter a complete phone number including country code.";
  }

  return message;
}

export function ConfirmedMemberDetailsForm() {
  const details = useQuery(api.confirmedMembers.getMine);
  const config = useQuery(api.config.getConfig);
  const invites = useQuery(api.newbieInvites.listMine);
  const upsertDetails = useMutation(api.confirmedMembers.upsertMine);
  const submitInvite = useMutation(api.newbieInvites.submitInvite);
  const sendInviteEmail = useAction(api.newbieInvitesActions.sendInviteEmail);

  const [hasBurningManTicket, setHasBurningManTicket] = useState(false);
  const [hasVehiclePass, setHasVehiclePass] = useState(false);
  const [requests, setRequests] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [newbieName, setNewbieName] = useState("");
  const [newbiePhone, setNewbiePhone] = useState("");
  const [newbieEmail, setNewbieEmail] = useState("");
  const [whyTheyBelong, setWhyTheyBelong] = useState("");
  const [preparednessAcknowledged, setPreparednessAcknowledged] = useState(false);
  const [inviteState, setInviteState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!details) return;
    setHasBurningManTicket(details.hasBurningManTicket);
    setHasVehiclePass(details.hasVehiclePass);
    setRequests(details.requests ?? "");
  }, [details]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState("saving");
    setSubmitError(null);

    try {
      await upsertDetails({
        hasBurningManTicket,
        hasVehiclePass,
        requests,
      });
      setSubmitState("saved");
    } catch (error) {
      setSubmitState("error");
      setSubmitError(error instanceof Error ? error.message : "Failed to update details");
    }
  };

  const performInviteSubmit = async () => {
    setInviteState("saving");
    setInviteError(null);

    if (!newbieName.trim()) {
      setInviteState("error");
      setInviteError("Newbie full name is required.");
      return;
    }

    if (!newbieEmail.trim()) {
      setInviteState("error");
      setInviteError("Newbie email is required.");
      return;
    }

    const canonicalPhone = canonicalizePhoneInput(newbiePhone);

    if (!canonicalPhone || canonicalPhone === "+") {
      setInviteState("error");
      setInviteError("Newbie phone number is required.");
      return;
    }

    if (!isValidE164Phone(canonicalPhone)) {
      setInviteState("error");
      setInviteError("Please enter a complete phone number including country code.");
      return;
    }

    if (!whyTheyBelong.trim()) {
      setInviteState("error");
      setInviteError("Please explain why this person would be a good addition.");
      return;
    }

    if (!preparednessAcknowledged) {
      setInviteState("error");
      setInviteError("You must acknowledge sponsorship responsibilities.");
      return;
    }

    try {
      const invite = await submitInvite({
        newbieName,
        newbiePhone: canonicalPhone,
        newbieEmail,
        whyTheyBelong,
        preparednessAcknowledged,
      });

      await sendInviteEmail({
        inviteId: invite.inviteId,
        newbieEmail: invite.inviteEmail,
        sponsorName: invite.sponsorName,
      });

      setInviteState("saved");
      setNewbieName("");
      setNewbiePhone("");
      setNewbieEmail("");
      setWhyTheyBelong("");
      setPreparednessAcknowledged(false);
    } catch (error) {
      setInviteState("error");
      setInviteError(getFriendlyErrorMessage(error, "Failed to send invite"));
    }
  };

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await performInviteSubmit();
  };

  if (details === null) {
    return null;
  }

  if (details === undefined || invites === undefined || config === undefined) {
    return <p className="mt-6 text-sm text-slate-400">Loading confirmed-member details...</p>;
  }

  const invitesEnabled = (config.newbieInvitesEnabled ?? "true") === "true";
  const canSponsorNewbies = (details.memberType ?? "alumni") === "alumni" && invitesEnabled;

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-lg bg-white/5 p-4 ring-1 ring-white/10 text-left">
      <h3 className="text-sm font-semibold text-white">Confirmed Member Details</h3>
      <p className="mt-1 text-xs text-slate-400">
        Update logistics details as your plans firm up.
      </p>

      <label className="mt-4 flex items-center justify-between gap-4 text-sm text-slate-200">
        <span>Has Burning Man ticket</span>
        <input
          type="checkbox"
          checked={hasBurningManTicket}
          onChange={(event) => setHasBurningManTicket(event.target.checked)}
          className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
        />
      </label>

      <label className="mt-3 flex items-center justify-between gap-4 text-sm text-slate-200">
        <span>Has Vehicle Pass</span>
        <input
          type="checkbox"
          checked={hasVehiclePass}
          onChange={(event) => setHasVehiclePass(event.target.checked)}
          className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
        />
      </label>

      <label className="mt-3 block text-sm text-slate-200">
        Requests (optional)
        <textarea
          value={requests}
          onChange={(event) => setRequests(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          placeholder="Anything ops should know (ride-share, arrival changes, etc.)"
        />
      </label>

      {submitError && <p className="mt-3 text-xs text-red-400">{submitError}</p>}
      {submitState === "saved" && <p className="mt-3 text-xs text-emerald-400">Details updated.</p>}

      <button
        type="submit"
        disabled={submitState === "saving"}
        className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700"
      >
        {submitState === "saving" ? "Saving..." : "Save Details"}
      </button>

      {canSponsorNewbies && (
        <div className="mt-8 border-t border-white/10 pt-6">
          <h3 className="text-sm font-semibold text-white">Sponsor a Newbie</h3>
          <p className="mt-1 text-xs text-slate-400">
            Invite someone new to camp. They will be able to sign in and apply immediately.
          </p>

          <div className="mt-4 space-y-3">
            <label className="block text-sm text-slate-200">
              Full Name
              <input
                type="text"
                value={newbieName}
                onChange={(event) => setNewbieName(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="Sam Patel"
              />
            </label>

            <label className="block text-sm text-slate-200">
              Phone Number
              <input
                type="tel"
                value={formatPhoneDisplay(newbiePhone)}
                onChange={(event) => setNewbiePhone(canonicalizePhoneInput(event.target.value))}
                className="mt-2 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="+1 555 123 1234"
              />
            </label>

            <label className="block text-sm text-slate-200">
              Email
              <input
                type="email"
                value={newbieEmail}
                onChange={(event) => setNewbieEmail(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="newbie@example.com"
              />
            </label>

            <label className="block text-sm text-slate-200">
              Why would they be a good addition?
              <textarea
                value={whyTheyBelong}
                onChange={(event) => setWhyTheyBelong(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="Tell ops why this person is a fit for camp."
              />
            </label>

            <label className="flex items-start gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={preparednessAcknowledged}
                onChange={(event) => setPreparednessAcknowledged(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span>I have consciously sponsored this person and will properly prepare them.</span>
            </label>

            {inviteError && <p className="text-xs text-red-400">{inviteError}</p>}
            {inviteState === "saved" && <p className="text-xs text-emerald-400">Invite sent.</p>}

            <button
              type="button"
              onClick={() => {
                void performInviteSubmit();
              }}
              disabled={inviteState === "saving"}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700"
            >
              {inviteState === "saving" ? "Sending..." : "Send Invite"}
            </button>
          </div>

          {invites.length > 0 && (
            <div className="mt-6 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sponsored Newbies
              </h4>
              {invites.map((invite) => (
                <div
                  key={invite._id}
                  className="rounded-lg bg-slate-900/70 px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{invite.newbieName}</p>
                      <p className="text-xs text-slate-400">{invite.newbieEmail}</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 ring-1 ring-emerald-400/30">
                      {invite.derivedStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
