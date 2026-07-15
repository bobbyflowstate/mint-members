"use client";

import { useState } from "react";
import Link from "next/link";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AuthModal, UserButton } from "@/components/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Spinner } from "@/components/Spinner";
import {
  BurnsEmergencySection,
  CampSection,
  CompletenessSummary,
  MealsSection,
  PhotoSection,
  SleepingSection,
  StatusSection,
  TransportSection,
} from "@/components/profile";
import { computeProfileCompleteness } from "@/lib/attendeeProfile/completeness";
import { AppConfig, LandingContent, getLandingContent } from "@/config/content";

function ProfileSections({ content }: { content: LandingContent }) {
  const data = useQuery(api.attendeeProfiles.getMine);

  if (data === undefined) {
    return <Spinner />;
  }

  if (data === null) {
    return (
      <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10 text-center">
        <h2 className="text-xl font-semibold text-white">No Active Application</h2>
        <p className="mt-2 text-slate-400 max-w-sm mx-auto">
          Your attendee profile becomes available once you have an active application.
        </p>
        <Link
          href="/apply"
          className="mt-6 inline-block rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 transition-all"
        >
          Go to Application
        </Link>
      </div>
    );
  }

  const completeness = computeProfileCompleteness(
    data.profile,
    data.application,
    content.departureCutoff
  );
  const sectionComplete = new Map(
    completeness.sections.map((section) => [section.key, section.complete])
  );

  return (
    <div className="space-y-4">
      <CompletenessSummary completeness={completeness} />
      <PhotoSection data={data} complete={sectionComplete.get("photo") ?? false} />
      <StatusSection
        data={data}
        content={content}
        complete={sectionComplete.get("status") ?? false}
      />
      <BurnsEmergencySection
        data={data}
        complete={sectionComplete.get("burnsEmergency") ?? false}
      />
      <TransportSection
        data={data}
        complete={sectionComplete.get("transport") ?? false}
      />
      <SleepingSection
        data={data}
        complete={sectionComplete.get("sleeping") ?? false}
      />
      <MealsSection data={data} complete={sectionComplete.get("meals") ?? false} />
      <CampSection data={data} />
    </div>
  );
}

export default function ProfilePage() {
  const config = useQuery(api.config.getConfig);
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (!config) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </main>
    );
  }

  const content = getLandingContent(config as AppConfig);

  return (
    <main className="min-h-screen py-12 sm:py-20">
      <div className="mx-auto max-w-2xl px-6 lg:px-8">
        <div className="mb-10 flex items-start justify-between">
          <div>
            <Link
              href="/dashboard"
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
              Back to Camp Dashboard
            </Link>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Attendee Profile
            </h1>
            <p className="mt-3 text-slate-300">
              Fill this in as your plans firm up — each section saves on its own.
            </p>
          </div>
          <Authenticated>
            <UserButton />
          </Authenticated>
        </div>

        <AuthLoading>
          <Spinner />
        </AuthLoading>

        <Unauthenticated>
          <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10 text-center">
            <h2 className="text-xl font-semibold text-white">Sign in to continue</h2>
            <p className="mt-2 text-slate-400 max-w-sm mx-auto">
              Your attendee profile is tied to your account.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="mt-6 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 transition-all"
            >
              Sign In / Sign Up
            </button>
          </div>
        </Unauthenticated>

        <Authenticated>
          <ErrorBoundary>
            <ProfileSections content={content} />
          </ErrorBoundary>
        </Authenticated>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        redirectTo="/profile"
      />
    </main>
  );
}
