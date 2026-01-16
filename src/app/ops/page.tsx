"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function OpsHomePage() {
  const pendingReviews = useQuery(api.applications.listNeedingReview);
  const recentEvents = useQuery(api.eventLogs.listRecent, { limit: 5 });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Ops Dashboard</h1>
        <p className="mt-2 text-slate-400">
          Overview of pending tasks and recent activity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
