"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function ConfirmedMemberDetailsForm() {
  const details = useQuery(api.confirmedMembers.getMine);
  const upsertDetails = useMutation(api.confirmedMembers.upsertMine);

  const [hasBurningManTicket, setHasBurningManTicket] = useState(false);
  const [hasVehiclePass, setHasVehiclePass] = useState(false);
  const [requests, setRequests] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  if (details === null) {
    return null;
  }

  if (details === undefined) {
    return <p className="mt-6 text-sm text-slate-400">Loading confirmed-member details...</p>;
  }

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
    </form>
  );
}
