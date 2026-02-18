"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import clsx from "clsx";

export function ReviewTable() {
  const applications = useQuery(api.applications.listNeedingReview);
  const setOpsOverride = useMutation(api.applications.setOpsOverride);
  
  const [processingId, setProcessingId] = useState<Id<"applications"> | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const handleAction = async (
    applicationId: Id<"applications">,
    approved: boolean
  ) => {
    setProcessingId(applicationId);
    try {
      await setOpsOverride({
        applicationId,
        approved,
        approverEmail: "ops@dementha.com", // In production, use actual user email
        notes: notes[applicationId] || undefined,
      });
    } catch (error) {
      console.error("Failed to process override:", error);
    } finally {
      setProcessingId(null);
    }
  };

  if (applications === undefined) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-slate-400">Loading applications...</p>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12 rounded-xl bg-white/5 ring-1 ring-white/10">
        <svg
          className="mx-auto h-12 w-12 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-white">All caught up!</h3>
        <p className="mt-2 text-slate-400">No applications pending review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 md:hidden">
        {applications.map((app) => (
          <article
            key={app._id}
            className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {app.firstName} {app.lastName}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Applied {new Date(app.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className="inline-flex rounded-full bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-300">
                Early departure
              </span>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Contact</dt>
                <dd className="text-slate-200 break-all">{app.email}</dd>
                <dd className="text-slate-400">{app.phone}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Dates</dt>
                <dd className="text-slate-200">
                  {app.arrival} {"\u2192"} {app.departure}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Departure time
                </dt>
                <dd className="text-slate-200">
                  {app.departureTime || (
                    <span className="text-slate-500 italic">Not specified</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Reason for early departure
                </dt>
                <dd className="text-slate-200 whitespace-pre-wrap">
                  {app.earlyDepartureReason || (
                    <span className="text-slate-500 italic">No reason provided</span>
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-3">
              <label
                htmlFor={`ops-note-${app._id}`}
                className="block text-xs uppercase tracking-wide text-slate-500"
              >
                Ops notes
              </label>
              <input
                id={`ops-note-${app._id}`}
                type="text"
                placeholder="Add ops notes..."
                value={notes[app._id] || ""}
                onChange={(e) =>
                  setNotes((prev) => ({ ...prev, [app._id]: e.target.value }))
                }
                className="mt-1 w-full bg-white/5 border-0 rounded px-3 py-2 text-sm text-white placeholder:text-slate-500 ring-1 ring-white/10 focus:ring-emerald-500"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAction(app._id, true)}
                disabled={processingId === app._id}
                className={clsx(
                  "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  processingId === app._id
                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                )}
              >
                {processingId === app._id ? "..." : "Approve"}
              </button>
              <button
                onClick={() => handleAction(app._id, false)}
                disabled={processingId === app._id}
                className={clsx(
                  "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  processingId === app._id
                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                )}
              >
                {processingId === app._id ? "..." : "Deny"}
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden md:block rounded-xl bg-white/5 ring-1 ring-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] divide-y divide-white/10">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Applicant
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Departure Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Reason for Early Departure
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Ops Notes
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {applications.map((app) => (
                <tr key={app._id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">
                      {app.firstName} {app.lastName}
                    </div>
                    <div className="text-xs text-slate-500">
                      Applied {new Date(app.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">{app.email}</div>
                    <div className="text-xs text-slate-500">{app.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {app.arrival} {"\u2192"} {app.departure}
                    </div>
                    <div className="text-xs text-amber-400">Early departure</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {app.departureTime || (
                        <span className="text-xs text-slate-500 italic">
                          Not specified
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      {app.earlyDepartureReason ? (
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">
                          {app.earlyDepartureReason}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-500 italic">
                          No reason provided
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      placeholder="Add ops notes..."
                      value={notes[app._id] || ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [app._id]: e.target.value }))
                      }
                      className="w-full bg-white/5 border-0 rounded px-2 py-1 text-sm text-white placeholder:text-slate-500 ring-1 ring-white/10 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleAction(app._id, true)}
                        disabled={processingId === app._id}
                        className={clsx(
                          "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                          processingId === app._id
                            ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                            : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                        )}
                      >
                        {processingId === app._id ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => handleAction(app._id, false)}
                        disabled={processingId === app._id}
                        className={clsx(
                          "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                          processingId === app._id
                            ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                            : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        )}
                      >
                        {processingId === app._id ? "..." : "Deny"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
