"use client";

import Link from "next/link";
import { ApplicationForm } from "@/components/forms";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getLandingContent } from "@/config/content";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function ApplyPage() {
  const config = useQuery(api.config.getConfig);
  const content = getLandingContent(config ?? undefined);

  return (
    <main className="min-h-screen py-12 sm:py-20">
      <div className="mx-auto max-w-2xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back to home
          </Link>
          
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Apply to Join {content.campName}
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            Complete the form below to reserve your spot at Burning Man 2025.
            The reservation fee is {content.reservationFeeFormatted}.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10">
          <ErrorBoundary>
            <ApplicationForm />
          </ErrorBoundary>
        </div>

        {/* Info Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            Questions? Contact us via WhatsApp or email.
          </p>
        </div>
      </div>
    </main>
  );
}
