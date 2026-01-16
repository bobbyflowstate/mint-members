"use client";

import { useState } from "react";
import Link from "next/link";
import { ApplicationForm } from "@/components/forms";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthModal, UserButton } from "@/components/auth";
import { getLandingContent } from "@/config/content";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

export default function ApplyPage() {
  const config = useQuery(api.config.getConfig);
  const content = getLandingContent(config ?? undefined);
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <main className="min-h-screen py-12 sm:py-20">
      <div className="mx-auto max-w-2xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 flex items-start justify-between">
          <div>
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
          
          <Authenticated>
            <UserButton />
          </Authenticated>
        </div>

        {/* Loading State */}
        <AuthLoading>
          <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          </div>
        </AuthLoading>

        {/* Not Signed In */}
        <Unauthenticated>
          <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10">
            <div className="text-center py-8">
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
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
              </div>
              <h2 className="mt-6 text-xl font-semibold text-white">
                Sign in to Apply
              </h2>
              <p className="mt-2 text-slate-400 max-w-sm mx-auto">
                You need to create an account or sign in before submitting your
                application. This helps us track your reservation.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 transition-all"
                >
                  Sign In / Sign Up
                </button>
              </div>
            </div>
          </div>
        </Unauthenticated>

        {/* Signed In - Show Form */}
        <Authenticated>
          <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10">
            <ErrorBoundary>
              <ApplicationFormWithCheck content={content} />
            </ErrorBoundary>
          </div>
        </Authenticated>

        {/* Info Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            Questions? Contact us via WhatsApp or email.
          </p>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="signUp"
      />
    </main>
  );
}

/**
 * Wrapper component that checks for existing application
 */
function ApplicationFormWithCheck({ content }: { content: ReturnType<typeof getLandingContent> }) {
  const existingApplication = useQuery(api.applications.getMyApplication);

  // Loading state
  if (existingApplication === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // User already has an application
  if (existingApplication) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 ring-1 ring-blue-500/20">
          <svg
            className="h-8 w-8 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
            />
          </svg>
        </div>
        <h2 className="mt-6 text-xl font-semibold text-white">
          Application Already Submitted
        </h2>
        <p className="mt-2 text-slate-400">
          You&apos;ve already submitted an application.
        </p>
        
        <div className="mt-6 rounded-lg bg-white/5 p-4 ring-1 ring-white/10 text-left max-w-sm mx-auto">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Status:</span>
            <span className={`font-medium ${
              existingApplication.status === "confirmed" ? "text-emerald-400" :
              existingApplication.status === "rejected" ? "text-red-400" :
              existingApplication.status === "needs_ops_review" ? "text-amber-400" :
              "text-blue-400"
            }`}>
              {existingApplication.status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-slate-400">Dates:</span>
            <span className="text-white">
              {existingApplication.arrival} → {existingApplication.departure}
            </span>
          </div>
        </div>

        {existingApplication.status === "pending_payment" && existingApplication.paymentAllowed && (
          <div className="mt-6">
            <p className="text-slate-300 mb-4">
              Complete your payment to secure your spot:
            </p>
            <Link
              href={`/apply/payment?id=${existingApplication._id}`}
              className="inline-block rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 transition-all"
            >
              Complete Payment ({content.reservationFeeFormatted})
            </Link>
          </div>
        )}

        {existingApplication.status === "needs_ops_review" && (
          <p className="mt-6 text-sm text-amber-400">
            Your early departure request is pending review. We&apos;ll contact you via WhatsApp.
          </p>
        )}

        {existingApplication.status === "confirmed" && (
          <p className="mt-6 text-sm text-emerald-400">
            Your reservation is confirmed! See you at {content.campName}!
          </p>
        )}
      </div>
    );
  }

  // No existing application - show form
  return <ApplicationForm />;
}
