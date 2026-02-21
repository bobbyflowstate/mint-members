"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import clsx from "clsx";

type ReviewDecision = "pending" | "approved" | "denied";

const REVIEW_SECTION_ORDER: ReviewDecision[] = ["pending", "approved", "denied"];

const reviewSectionTitles: Record<ReviewDecision, string> = {
  pending: "Not Yet Reviewed",
  approved: "Approved",
  denied: "Denied",
};

const reviewSectionDescriptions: Record<ReviewDecision, string> = {
  pending: "Applications waiting for an ops decision.",
  approved: "Applications approved by ops for early departure.",
  denied: "Applications denied by ops for early departure.",
};

const reviewSectionEmptyMessages: Record<ReviewDecision, string> = {
  pending: "No applications are currently waiting for review.",
  approved: "No approved early-departure applications yet.",
  denied: "No denied early-departure applications yet.",
};

const reviewSectionCountBadgeClasses: Record<ReviewDecision, string> = {
  pending: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  approved: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  denied: "bg-red-500/15 text-red-300 ring-red-400/30",
};

function getReviewDecision(status: string): ReviewDecision {
  if (status === "rejected") {
    return "denied";
  }
  if (status === "needs_ops_review") {
    return "pending";
  }
  return "approved";
}

function getActionButtonClasses(
  action: "approve" | "deny",
  disabled: boolean,
  isDesktop = false
) {
  return clsx(
    isDesktop
      ? "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
      : "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
    disabled
      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
      : action === "approve"
        ? isDesktop
          ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
          : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
        : isDesktop
          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
          : "bg-red-500/20 text-red-300 hover:bg-red-500/30"
  );
}

export function ReviewTable() {
  const applications = useQuery(api.applications.listReviewQueue);
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
        <p className="mt-2 text-slate-400">
          No early-departure applications in the review queue.
        </p>
      </div>
    );
  }

  const groupedApplications: Record<ReviewDecision, typeof applications> = {
    pending: applications.filter((app) => getReviewDecision(app.status) === "pending"),
    approved: applications.filter((app) => getReviewDecision(app.status) === "approved"),
    denied: applications.filter((app) => getReviewDecision(app.status) === "denied"),
  };

  return (
    <div className="space-y-8">
      {REVIEW_SECTION_ORDER.map((decision) => {
        const sectionApplications = groupedApplications[decision];

        return (
          <section key={decision} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {reviewSectionTitles[decision]}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {reviewSectionDescriptions[decision]}
                </p>
              </div>
              <span
                className={clsx(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                  reviewSectionCountBadgeClasses[decision]
                )}
              >
                {sectionApplications.length}
              </span>
            </div>

            {sectionApplications.length === 0 ? (
              <div className="rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
                <p className="text-sm text-slate-400">
                  {reviewSectionEmptyMessages[decision]}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-3 md:hidden">
                  {sectionApplications.map((app) => {
                    const currentDecision = getReviewDecision(app.status);
                    const isProcessing = processingId === app._id;
                    const isApproveDisabled = isProcessing || currentDecision === "approved";
                    const isDenyDisabled = isProcessing || currentDecision === "denied";

                    return (
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
                        </div>
                        <dl className="mt-3 space-y-2 text-sm">
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-slate-500">
                              Contact
                            </dt>
                            <dd className="text-slate-200 break-all">{app.email}</dd>
                            <dd className="text-slate-400">{app.phone}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-slate-500">
                              Dates
                            </dt>
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
                                <span className="text-slate-500 italic">
                                  No reason provided
                                </span>
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
                            disabled={isApproveDisabled}
                            className={getActionButtonClasses("approve", isApproveDisabled)}
                          >
                            {isProcessing ? "..." : "Approve"}
                          </button>
                          <button
                            onClick={() => handleAction(app._id, false)}
                            disabled={isDenyDisabled}
                            className={getActionButtonClasses("deny", isDenyDisabled)}
                          >
                            {isProcessing ? "..." : "Deny"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
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
                        {sectionApplications.map((app) => {
                          const currentDecision = getReviewDecision(app.status);
                          const isProcessing = processingId === app._id;
                          const isApproveDisabled =
                            isProcessing || currentDecision === "approved";
                          const isDenyDisabled = isProcessing || currentDecision === "denied";

                          return (
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
                                    disabled={isApproveDisabled}
                                    className={getActionButtonClasses(
                                      "approve",
                                      isApproveDisabled,
                                      true
                                    )}
                                  >
                                    {isProcessing ? "..." : "Approve"}
                                  </button>
                                  <button
                                    onClick={() => handleAction(app._id, false)}
                                    disabled={isDenyDisabled}
                                    className={getActionButtonClasses(
                                      "deny",
                                      isDenyDisabled,
                                      true
                                    )}
                                  >
                                    {isProcessing ? "..." : "Deny"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
