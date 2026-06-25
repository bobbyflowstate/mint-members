"use client";

import { useState } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

const ARRIVAL_TIME_OPTIONS = [
  { value: "12:01 am to 11.00 am", label: "12:01 am – 11:00 am" },
  { value: "11.01 am to 6.00 pm", label: "11:01 am – 6:00 pm" },
  { value: "6.01 pm to 12.00 am", label: "6:01 pm – 12:00 am" },
] as const;

type ArrivalTime = (typeof ARRIVAL_TIME_OPTIONS)[number]["value"];

interface Props {
  opsPassword: string;
  onClose: () => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm text-slate-200">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50";

const selectCls =
  "w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50";

export function AddManualMemberModal({ opsPassword, onClose }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [memberType, setMemberType] = useState<"alumni" | "newbie">("alumni");
  const [arrival, setArrival] = useState("");
  const [arrivalTime, setArrivalTime] = useState<ArrivalTime>("11.01 am to 6.00 pm");
  const [departure, setDeparture] = useState("");
  const [departureTime, setDepartureTime] = useState<ArrivalTime>("11.01 am to 6.00 pm");
  const [notes, setNotes] = useState("");
  const [hasFullPayment, setHasPaid] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);

  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const config = useQuery(api.config.getConfig);
  const addMember = useMutation(api.opsManualInvites.add);
  const sendInviteEmail = useAction(api.opsManualInvitesActions.sendInviteEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      setErrorMsg("Name, email, and phone are required.");
      return;
    }
    if (!arrival || !departure) {
      setErrorMsg("Arrival and departure dates are required.");
      return;
    }

    setStatus("saving");
    setErrorMsg(null);
    setEmailError(null);

    let inviteId: Id<"ops_manual_invites">;
    try {
      const result = await addMember({
        opsPassword,
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        memberType,
        arrival,
        arrivalTime,
        departure,
        departureTime,
        notes: notes.trim() || undefined,
        hasFullPayment,
      });
      inviteId = result.inviteId as Id<"ops_manual_invites">;
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to add member");
      return;
    }

    if (sendEmail) {
      try {
        await sendInviteEmail({ opsPassword, inviteId });
      } catch (err) {
        setEmailError(err instanceof Error ? err.message : "Failed to send invite email");
      }
    }

    setStatus("done");
  };

  if (status === "done") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-xl bg-slate-900 p-6 ring-1 ring-white/10 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">Member Added</h3>
          <p className="text-sm text-slate-400">
            {firstName.trim()} has been added.{" "}
            {emailError
              ? ""
              : sendEmail
              ? "An invite email has been sent."
              : "No invite email sent."}
          </p>
          {emailError && (
            <p className="text-sm text-amber-400">
              Member was added, but the invite email failed to send: {emailError}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/30 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl bg-slate-900 ring-1 ring-white/10 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Add Member Manually</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First Name *">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputCls}
                placeholder="Sam"
                required
              />
            </Field>
            <Field label="Last Name *">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputCls}
                placeholder="Patel"
                required
              />
            </Field>
          </div>

          <Field label="Email *">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="sam@example.com"
              required
            />
          </Field>

          <Field label="Phone *">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
              placeholder="+1 555 123 4567"
              required
            />
          </Field>

          <Field label="Member Type">
            <select
              value={memberType}
              onChange={(e) => setMemberType(e.target.value as "alumni" | "newbie")}
              className={selectCls}
            >
              <option value="alumni">Alumni</option>
              <option value="newbie">Newbie</option>
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Arrival Date *">
              <input
                type="date"
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
                min={config?.earliestArrival}
                max={config?.latestDeparture}
                className={inputCls}
                required
              />
            </Field>
            <Field label="Arrival Time Window">
              <select
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value as ArrivalTime)}
                className={selectCls}
              >
                {ARRIVAL_TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Departure Date *">
              <input
                type="date"
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
                min={config?.earliestArrival}
                max={config?.latestDeparture}
                className={inputCls}
                required
              />
            </Field>
            <Field label="Departure Time Window">
              <select
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value as ArrivalTime)}
                className={selectCls}
              >
                {ARRIVAL_TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Ops Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputCls}
              placeholder="Any context for ops..."
            />
          </Field>

          <label className="flex items-center gap-3 text-sm text-slate-200 rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasFullPayment}
              onChange={(e) => setHasPaid(e.target.checked)}
              className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
            />
            Mark as paid in full
          </label>

          <label className="flex items-center gap-3 text-sm text-slate-200 rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
            />
            Send invite email to member
          </label>

          {errorMsg && (
            <p className="text-sm text-red-400" role="alert">{errorMsg}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === "saving"}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "saving" ? "Adding..." : "Add Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
