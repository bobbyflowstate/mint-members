"use client";

import { FormEvent, ReactNode, useState } from "react";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";

export type ProfileData = NonNullable<
  FunctionReturnType<typeof api.attendeeProfiles.getMine>
>;
export type VehicleOption = FunctionReturnType<typeof api.vehicles.list>[number];
export type SleepingGroupOption = FunctionReturnType<
  typeof api.sleepingGroups.list
>[number];

export type SaveState = "idle" | "saving" | "saved" | "error";

function friendlyErrorMessage(error: unknown, fallback: string): string {
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
  return message || fallback;
}

export function useSaveState() {
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const run = async (save: () => Promise<void>) => {
    setState("saving");
    setError(null);
    try {
      await save();
      setState("saved");
    } catch (err) {
      setState("error");
      setError(friendlyErrorMessage(err, "Failed to save"));
    }
  };

  const markDirty = () => {
    if (state === "saved") {
      setState("idle");
    }
  };

  return { state, error, run, markDirty };
}

/**
 * A profile section: card shell, completeness badge, form wiring, and a
 * save button with localized state so one section's failure never blocks
 * another's save.
 */
export function SectionCard({
  title,
  sub,
  complete,
  saveState,
  error,
  onSave,
  children,
}: {
  title: string;
  sub?: string;
  complete?: boolean;
  saveState: SaveState;
  error: string | null;
  onSave: () => Promise<void> | void;
  children: ReactNode;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSave();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white/5 backdrop-blur-sm p-6 ring-1 ring-white/10"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        {complete !== undefined && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs ring-1 ${
              complete
                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30"
                : "bg-amber-500/10 text-amber-300 ring-amber-400/30"
            }`}
          >
            {complete ? "Complete" : "Incomplete"}
          </span>
        )}
      </div>

      <div className="mt-5 space-y-4">{children}</div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {saveState === "saved" && !error && (
        <p className="mt-4 text-sm text-emerald-400">Saved.</p>
      )}

      <button
        type="submit"
        disabled={saveState === "saving"}
        className="mt-5 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 transition-all disabled:cursor-not-allowed disabled:bg-emerald-700"
      >
        {saveState === "saving" ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

/**
 * Highlighted box for conditionally revealed fields, matching the
 * early-departure treatment used elsewhere in the app.
 */
export function ConditionalBox({
  flag,
  children,
}: {
  flag: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-amber-300/30 bg-amber-500/10 p-4 ring-1 ring-amber-400/10">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
        {flag}
      </p>
      {children}
    </div>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md bg-white/5 px-3 py-2 text-xs text-slate-400 ring-1 ring-white/10">
      {children}
    </p>
  );
}
