"use client";

import { ChangeEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ShiftsTable } from "@/components/shifts/ShiftsTable";
import { Spinner } from "@/components/Spinner";
import { parseShiftsCsv } from "@/lib/shifts/csv";
import type { ShiftRow } from "@/lib/shifts/types";

const OPS_PASSWORD_KEY = "ops_password";

export default function OpsShiftsPage() {
  const [opsPassword] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(OPS_PASSWORD_KEY);
    }
    return null;
  });
  const published = useQuery(
    api.shifts.getPublishedForOps,
    opsPassword ? { opsPassword } : "skip"
  );
  const publishSchedule = useMutation(api.shifts.publish);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ShiftRow[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(null);
    setRows(null);
    setFileName(file.name);
    try {
      const result = await parseShiftsCsv(file);
      setRows(result.rows);
      setWarnings(result.warnings);
      setNotices(result.notices);
    } catch (cause) {
      setWarnings([]);
      setNotices([]);
      setError(cause instanceof Error ? cause.message : "Could not parse this CSV.");
    }
  };

  const discard = () => {
    setRows(null);
    setWarnings([]);
    setNotices([]);
    setError(null);
    setSuccess(null);
    setFileName("");
  };

  const publish = async () => {
    const opsPassword = sessionStorage.getItem(OPS_PASSWORD_KEY);
    if (!rows || !opsPassword) {
      setError("Ops password is missing. Refresh and sign in again.");
      return;
    }
    if (!window.confirm(`Publish ${rows.length} shifts and replace the current schedule?`)) return;
    setError(null);
    setSuccess(null);
    setIsPublishing(true);
    try {
      const result = await publishSchedule({ opsPassword, rows });
      setSuccess(`Published ${result.rowCount} shifts.`);
      setRows(null);
      setWarnings([]);
      setFileName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publishing failed.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Shifts</h1>
        <p className="mt-2 text-slate-400">
          Upload an exported schedule, review the member view, then publish it.
          Publishing replaces the current schedule.
        </p>
      </div>

      <section className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
        <label className="block text-sm font-semibold text-white" htmlFor="shifts-csv">
          Schedule CSV
        </label>
        <input
          id="shifts-csv"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="mt-3 block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-emerald-400"
        />
        {fileName && <p className="mt-2 text-xs text-slate-500">Selected: {fileName}</p>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-500/30">{error}</p>}
        {success && <p role="status" className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300 ring-1 ring-emerald-500/30">{success}</p>}
      </section>

      {rows && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Publication preview</h2>
              <p className="mt-1 text-sm text-slate-400">{rows.length} shifts are ready to publish.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={discard} disabled={isPublishing} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">
                Discard
              </button>
              <button type="button" onClick={publish} disabled={isPublishing} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60">
                {isPublishing ? "Publishing…" : "Publish schedule"}
              </button>
            </div>
          </div>
          {notices.length > 0 && (
            <details className="rounded-xl bg-sky-500/10 p-4 text-sm text-sky-200 ring-1 ring-sky-500/30">
              <summary className="cursor-pointer font-semibold">
                {notices.length} comment {notices.length === 1 ? "row" : "rows"} skipped (not shift spots)
              </summary>
              <ul className="mt-3 list-disc space-y-1 pl-5">{notices.map((notice, index) => <li key={index}>{notice}</li>)}</ul>
            </details>
          )}
          {warnings.length > 0 && (
            <details className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-200 ring-1 ring-amber-500/30">
              <summary className="cursor-pointer font-semibold">{warnings.length} CSV formatting warnings</summary>
              <ul className="mt-3 list-disc space-y-1 pl-5">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            </details>
          )}
          <ShiftsTable rows={rows} />
        </section>
      )}

      {!rows && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Current published schedule</h2>
            {published?.publishedAt && (
              <p className="mt-1 text-sm text-slate-400">
                Published {new Date(published.publishedAt).toLocaleString()}
              </p>
            )}
          </div>
          {published === undefined && <Spinner />}
          {published === null && (
            <div className="rounded-2xl bg-white/5 p-8 text-center ring-1 ring-white/10">
              <p className="text-slate-400">No schedule has been published yet.</p>
            </div>
          )}
          {published && <ShiftsTable rows={published.rows} />}
        </section>
      )}
    </div>
  );
}
