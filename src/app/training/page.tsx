"use client";

import { useState } from "react";
import Link from "next/link";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AuthModal, UserButton } from "@/components/auth";
import { Spinner } from "@/components/Spinner";
import { trainingModules } from "@/lib/training/modules";

function TrainingCatalog() {
  const records = useQuery(api.training.listMine);
  if (records === undefined) return <Spinner />;

  return <div className="space-y-4">
    {trainingModules.map((module) => {
      const versions = records.filter((record) => record.moduleSlug === module.slug);
      const complete = versions.some((record) =>
        record.completedAt && module.completionPolicy.acceptedVersions.includes(record.moduleVersion)
      );
      const inProgress = versions.some((record) =>
        !record.completedAt && module.completionPolicy.acceptedVersions.includes(record.moduleVersion)
      );
      const status = complete ? "Complete" : inProgress ? "In progress" : "Not started";
      return <Link key={module.slug} href={`/training/${module.slug}`} className="group block rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-emerald-400/30 hover:bg-white/[.07]">
        <div className="flex items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap gap-2">
              {module.required && <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">Required</span>}
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">{module.estimatedMinutes} min</span>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-white group-hover:text-emerald-200">{module.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{module.description}</p>
            <p className="mt-4 text-xs text-slate-500">Version {module.version}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${complete ? "bg-emerald-400/10 text-emerald-300" : inProgress ? "bg-sky-400/10 text-sky-300" : "bg-white/5 text-slate-400"}`}>{status}</span>
        </div>
      </Link>;
    })}
  </div>;
}

export default function TrainingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  return <main className="min-h-screen py-12 sm:py-16">
    <div className="mx-auto max-w-3xl px-6 lg:px-8">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">← Camp dashboard</Link>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">Training</h1>
          <p className="mt-3 text-slate-300">Short, practical modules for arriving prepared and running camp well.</p>
        </div>
        <Authenticated><UserButton /></Authenticated>
      </header>
      <AuthLoading><Spinner /></AuthLoading>
      <Unauthenticated><div className="rounded-2xl bg-white/5 p-8 text-center ring-1 ring-white/10"><h2 className="text-xl font-semibold text-white">Sign in to access training</h2><p className="mt-2 text-slate-400">Your progress and completion are tied to your member account.</p><button className="mt-6 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white" onClick={() => setShowAuthModal(true)}>Sign In / Sign Up</button></div></Unauthenticated>
      <Authenticated><TrainingCatalog /></Authenticated>
    </div>
    <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} redirectTo="/training" />
  </main>;
}
