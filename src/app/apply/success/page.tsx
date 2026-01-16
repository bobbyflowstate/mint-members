"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <main className="min-h-screen flex items-center justify-center py-12 sm:py-20">
      <div className="mx-auto max-w-xl px-6 lg:px-8 text-center">
        {/* Success Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <svg
            className="h-10 w-10 text-emerald-400"
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
        </div>

        {/* Success Message */}
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Payment Successful!
        </h1>
        <p className="mt-4 text-lg text-slate-300">
          Your reservation has been confirmed. Welcome to DeMentha!
        </p>

        {/* Important Info Card */}
        <div className="mt-8 rounded-xl bg-white/5 backdrop-blur-sm p-6 ring-1 ring-white/10 text-left">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg
              className="h-5 w-5 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
            Next Steps: Join WhatsApp
          </h2>
          <div className="mt-4 space-y-3 text-slate-300">
            <p>
              All camp communication happens via WhatsApp. Make sure you:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>Have WhatsApp installed on your phone</li>
              <li>Watch for an invitation to our camp group</li>
              <li>Keep notifications enabled for important updates</li>
            </ul>
          </div>
        </div>

        {/* Confirmation Details */}
        {sessionId && (
          <p className="mt-6 text-xs text-slate-500">
            Confirmation ID: {sessionId}
          </p>
        )}

        {/* Back to Home */}
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </main>
    }>
      <SuccessContent />
    </Suspense>
  );
}
