"use client";

import Link from "next/link";

export default function ErrorPage() {
  return (
    <main className="min-h-screen flex items-center justify-center py-12 sm:py-20">
      <div className="mx-auto max-w-xl px-6 lg:px-8 text-center">
        {/* Error Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
          <svg
            className="h-10 w-10 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Error Message */}
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Payment Cancelled
        </h1>
        <p className="mt-4 text-lg text-slate-300">
          Your payment was cancelled or could not be processed.
          Don&apos;t worry - no charges have been made.
        </p>

        {/* What to do */}
        <div className="mt-8 rounded-xl bg-white/5 backdrop-blur-sm p-6 ring-1 ring-white/10 text-left">
          <h2 className="text-lg font-semibold text-white">
            What happened?
          </h2>
          <div className="mt-4 space-y-3 text-slate-300 text-sm">
            <p>This can happen if:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>You cancelled the payment</li>
              <li>The payment session expired</li>
              <li>There was an issue with your payment method</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/apply"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
          >
            Return to Home
          </Link>
        </div>

        {/* Help */}
        <p className="mt-8 text-sm text-slate-500">
          Having trouble? Contact us via WhatsApp for assistance.
        </p>
      </div>
    </main>
  );
}
