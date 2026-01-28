"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { isFlagEnabled } from "@/lib/config/flags";

const OPS_PASSWORD_KEY = "ops_password";

export default function OpsHomePage() {
  const [opsPassword] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(OPS_PASSWORD_KEY);
    }
    return null;
  });

  const pendingReviews = useQuery(api.applications.listNeedingReview);
  const recentEvents = useQuery(api.eventLogs.listRecent, { limit: 5 });
  const config = useQuery(api.config.getConfig);
  const updateConfig = useMutation(api.config.setConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");

  const paymentsEnabled = isFlagEnabled(config?.paymentsEnabled);

  const handlePaymentToggle = () => {
    if (!config) {
      return;
    }
    // Show confirmation dialog instead of toggling directly
    setShowConfirmDialog(true);
    setConfirmationText("");
  };

  const handleConfirmToggle = async () => {
    if (!config || !opsPassword) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);
    setShowConfirmDialog(false);
    setConfirmationText("");

    try {
      await updateConfig({
        key: "paymentsEnabled",
        value: paymentsEnabled ? "false" : "true",
        description: "Controls whether applicants can complete payments",
        opsPassword,
      });
    } catch (error) {
      console.error("Failed to toggle payments", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save payments setting. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelToggle = () => {
    setShowConfirmDialog(false);
    setConfirmationText("");
  };

  const isConfirmationValid = confirmationText === "minted2026";

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
          {errorMessage && (
            <p className="mt-3 text-sm text-amber-400" role="alert">
              {errorMessage}
            </p>
          )}
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

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl bg-slate-900 p-6 ring-1 ring-white/10 shadow-2xl">
            <h3 className="text-xl font-bold text-white">
              {paymentsEnabled ? "Disable Payments" : "Enable Payments"}
            </h3>
            <div className="mt-4 space-y-3">
              <p className="text-slate-300">
                You are about to{" "}
                <span className="font-semibold text-amber-400">
                  {paymentsEnabled ? "disable" : "enable"}
                </span>{" "}
                payments for all users.
              </p>
              <p className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg p-3">
                ⚠️ This action will immediately affect all applicants. Please ensure you
                actually want to proceed.
              </p>
              <div className="mt-4">
                <label htmlFor="confirmation" className="block text-sm font-medium text-slate-300 mb-2">
                  Type <span className="font-mono font-bold text-white">minted2026</span> to confirm:
                </label>
                <input
                  id="confirmation"
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="minted2026"
                  className="w-full rounded-lg bg-slate-800 px-4 py-2 text-white placeholder:text-slate-500 border border-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  autoFocus
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancelToggle}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggle}
                disabled={!isConfirmationValid}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
