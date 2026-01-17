"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { PaymentCTA } from "@/components/forms";
import { getLandingContent } from "@/config/content";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("id") as Id<"applications"> | null;
  
  const config = useQuery(api.config.getConfig);
  const content = getLandingContent(config ?? undefined);

  if (!applicationId) {
    return (
      <main className="min-h-screen py-12 sm:py-20">
        <div className="mx-auto max-w-2xl px-6 lg:px-8">
          <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
              <svg
                className="h-8 w-8 text-red-400"
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
            <h1 className="mt-6 text-2xl font-bold text-white">Invalid Request</h1>
            <p className="mt-2 text-slate-400">No application ID provided.</p>
            <Link
              href="/apply"
              className="mt-6 inline-block rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 transition-all"
            >
              Go to Application
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-12 sm:py-20">
      <div className="mx-auto max-w-2xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/apply"
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
            Back to application
          </Link>
          
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Complete Your Payment
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            Pay your reservation fee to secure your spot at {content.campName}.
          </p>
        </div>

        <AuthLoading>
          <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          </div>
        </AuthLoading>

        <Unauthenticated>
          <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10 text-center">
            <p className="text-slate-400">Please sign in to complete your payment.</p>
            <Link
              href="/apply"
              className="mt-4 inline-block rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 transition-all"
            >
              Sign In
            </Link>
          </div>
        </Unauthenticated>

        <Authenticated>
          <PaymentPageContent applicationId={applicationId} content={content} />
        </Authenticated>
      </div>
    </main>
  );
}

function PaymentPageContent({ 
  applicationId, 
  content 
}: { 
  applicationId: Id<"applications">; 
  content: ReturnType<typeof getLandingContent>;
}) {
  const application = useQuery(api.applications.getById, { applicationId });

  if (application === undefined) {
    return (
      <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
          <svg
            className="h-8 w-8 text-red-400"
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
        <h2 className="mt-6 text-xl font-bold text-white">Application Not Found</h2>
        <p className="mt-2 text-slate-400">
          We couldn&apos;t find this application. It may have been removed.
        </p>
        <Link
          href="/apply"
          className="mt-6 inline-block rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 transition-all"
        >
          Start New Application
        </Link>
      </div>
    );
  }

  if (application.status === "confirmed") {
    return (
      <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <svg
            className="h-8 w-8 text-emerald-400"
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
        <h2 className="mt-6 text-xl font-bold text-white">Already Confirmed!</h2>
        <p className="mt-2 text-slate-400">
          Your reservation is already confirmed. See you at {content.campName}!
        </p>
        <Link
          href="/apply"
          className="mt-6 inline-block rounded-lg bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-all"
        >
          View Application
        </Link>
      </div>
    );
  }

  if (!application.paymentAllowed) {
    return (
      <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/20">
          <svg
            className="h-8 w-8 text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="mt-6 text-xl font-bold text-white">Pending Review</h2>
        <p className="mt-2 text-slate-400">
          Your early departure request is being reviewed. Payment will be available after approval.
        </p>
        <Link
          href="/apply"
          className="mt-6 inline-block rounded-lg bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-all"
        >
          View Application
        </Link>
      </div>
    );
  }

  // Show payment form
  return (
    <div className="space-y-6">
      {/* Application summary */}
      <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-6 ring-1 ring-white/10">
        <h3 className="text-sm font-medium text-slate-400">Application Summary</h3>
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Name</span>
            <span className="text-white">{application.firstName} {application.lastName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Email</span>
            <span className="text-white">{application.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Dates</span>
            <span className="text-white">{application.arrival} → {application.departure}</span>
          </div>
        </div>
      </div>

      {/* Payment CTA */}
      <PaymentCTA
        applicationId={applicationId}
        amount={content.reservationFeeFormatted}
      />
    </div>
  );
}
