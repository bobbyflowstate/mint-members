"use client";

import Link from "next/link";
import { useState } from "react";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AuthModal, UserButton } from "@/components/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Spinner } from "@/components/Spinner";
import { ShiftsTable } from "@/components/shifts/ShiftsTable";

function PublishedSchedule() {
  const schedule = useQuery(api.shifts.getPublished);
  if (schedule === undefined) return <Spinner />;
  if (schedule === null) {
    return (
      <div className="rounded-2xl bg-white/5 p-8 text-center ring-1 ring-white/10">
        <h2 className="text-xl font-semibold text-white">Schedule coming soon</h2>
        <p className="mt-2 text-slate-400">Ops has not published the camp shifts yet.</p>
      </div>
    );
  }
  return (
    <>
      <p className="mb-4 text-xs text-slate-500">
        Published {new Date(schedule.publishedAt).toLocaleString()}
      </p>
      <ShiftsTable rows={schedule.rows} />
    </>
  );
}

export default function ShiftsPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  return (
    <main className="min-h-screen py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
              ← Camp dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Camp shifts</h1>
            <p className="mt-2 text-slate-400">
              Browse the full schedule and find shifts by member, day, or task.
            </p>
          </div>
          <Authenticated><UserButton /></Authenticated>
        </div>

        <AuthLoading><Spinner /></AuthLoading>
        <Unauthenticated>
          <div className="rounded-2xl bg-white/5 p-8 text-center ring-1 ring-white/10">
            <h2 className="text-xl font-semibold text-white">Sign in to see camp shifts</h2>
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="mt-6 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              Sign In / Sign Up
            </button>
          </div>
        </Unauthenticated>
        <Authenticated>
          <ErrorBoundary><PublishedSchedule /></ErrorBoundary>
        </Authenticated>
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} redirectTo="/shifts" />
    </main>
  );
}
