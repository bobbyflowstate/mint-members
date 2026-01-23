"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { isFlagEnabled } from "@/lib/config/flags";

export default function OpsHomePage() {
  const pendingReviews = useQuery(api.applications.listNeedingReview);
  const recentEvents = useQuery(api.eventLogs.listRecent, { limit: 5 });
  const config = useQuery(api.config.getConfig);
  const updateConfig = useMutation(api.config.setConfig);
  const [isSaving, setIsSaving] = useState(false);

  const paymentsEnabled = isFlagEnabled(config?.paymentsEnabled);

  const handlePaymentToggle = async () => {
    if (!config) {
      return;
    }

    setIsSaving(true);
    try {
      await updateConfig({
        key: "paymentsEnabled",
        value: paymentsEnabled ? "false" : "true",
        description: "Controls whether applicants can complete payments",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Ops Dashboard</h1>
        <p className="mt-2 text-slate-400">
          Overview of pending tasks and recent activity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Payments</h2>
              <p className="mt-2 text-sm text-slate-400">
                Toggle when applicants can complete payments. Applications can still be
                submitted while payments are disabled.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={paymentsEnabled}
              aria-label="Toggle payments"
              onClick={handlePaymentToggle}
              disabled={!config || isSaving}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                paymentsEnabled ? "bg-emerald-500" : "bg-slate-600"
              } ${isSaving ? "opacity-70" : ""} disabled:cursor-not-allowed`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  paymentsEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
            <span>
              Status:{" "}
              <span className={paymentsEnabled ? "text-emerald-400" : "text-amber-400"}>
                {paymentsEnabled ? "Enabled" : "Disabled"}
              </span>
            </span>
            {isSaving && <span className="text-slate-500">Saving...</span>}
          </div>
        </div>
        {/* Pending Reviews Card */}
        <div className="rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Pending Reviews</h2>
            <Link
              href="/ops/review"
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              View all →
            </Link>
          </div>
          <div className="mt-4">
            {pendingReviews === undefined ? (
              <div className="animate-pulse h-16 bg-white/10 rounded" />
            ) : (
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-white">
                  {pendingReviews.length}
                </div>
                <div className="text-sm text-slate-400">
                  {pendingReviews.length === 1
                    ? "application"
                    : "applications"}{" "}
                  awaiting review
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Card */}
        <div className="rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
            <Link
              href="/ops/logs"
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              View logs →
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {recentEvents === undefined ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse h-8 bg-white/10 rounded"
                  />
                ))}
              </div>
            ) : recentEvents.length === 0 ? (
              <p className="text-slate-500 text-sm">No recent activity</p>
            ) : (
              recentEvents.slice(0, 3).map((event) => (
                <div
                  key={event._id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-300">
                    {event.eventType.replace(/_/g, " ")}
                  </span>
                  <span className="text-slate-500">
                    {new Date(event.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
