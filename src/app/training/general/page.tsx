"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { AuthModal, UserButton } from "@/components/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Spinner } from "@/components/Spinner";
import { GeneralModuleRunner } from "@/components/training/GeneralModuleRunner";
import { generalModule } from "@/lib/training/general";
import { parseGeneralProgressState, selectModuleProgress } from "@/lib/training/progress";
import type { GeneralProgressState } from "@/lib/training/types";

function GeneralTraining() {
  const router = useRouter();
  const progressRecords = useQuery(api.training.listMine);
  const roster = useQuery(api.attendeeProfiles.listRoster);
  const save = useMutation(api.training.saveMine);
  const complete = useMutation(api.training.completeMine);

  if (progressRecords === undefined || roster === undefined) return <Spinner />;
  if (roster === null) return <div className="rounded-2xl bg-white/5 p-8 text-center ring-1 ring-white/10"><h2 className="text-xl font-semibold text-white">No active application</h2><p className="mt-2 text-slate-400">Member training becomes available once you have an active camp application.</p><Link className="mt-5 inline-block text-emerald-300" href="/apply">Go to application →</Link></div>;
  const memberName = roster.members.find((member) => member.isViewer)?.fullName ?? "DeMenthian";
  const progress = selectModuleProgress(
    progressRecords,
    generalModule.slug,
    generalModule.version,
    generalModule.completionPolicy.acceptedVersions
  );
  const serialize = (state: GeneralProgressState) => JSON.stringify(state);

  return <GeneralModuleRunner
    key={progress?._id ?? "new"}
    memberName={memberName}
    initialState={parseGeneralProgressState(progress?.state, Boolean(progress?.completedAt))}
    completedAt={progress?.completedAt}
    onSave={(state) => save({ moduleSlug: generalModule.slug, moduleVersion: generalModule.version, state: serialize(state) })}
    onComplete={(state) => complete({ moduleSlug: generalModule.slug, moduleVersion: generalModule.version, state: serialize(state) })}
    onDone={() => router.push("/training")}
  />;
}

export default function GeneralTrainingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  return <main className="min-h-screen py-6 sm:py-10">
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <header className="mb-5 flex items-center justify-between gap-4">
        <Link href="/training" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">← All training</Link>
        <Authenticated><UserButton /></Authenticated>
      </header>
      <AuthLoading><Spinner /></AuthLoading>
      <Unauthenticated><div className="rounded-2xl bg-white/5 p-8 text-center ring-1 ring-white/10"><h2 className="text-xl font-semibold text-white">Sign in to start training</h2><button className="mt-6 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white" onClick={() => setShowAuthModal(true)}>Sign In / Sign Up</button></div></Unauthenticated>
      <Authenticated><ErrorBoundary><GeneralTraining /></ErrorBoundary></Authenticated>
    </div>
    <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} redirectTo="/training/general" />
  </main>;
}
