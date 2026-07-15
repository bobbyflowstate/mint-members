"use client";

import { useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { AuthModal, UserButton } from "@/components/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Spinner } from "@/components/Spinner";
import { computeProfileCompleteness } from "@/lib/attendeeProfile/completeness";
import { SleepingType, TravelMode } from "@/lib/attendeeProfile/options";
import { formatDateWithWeekday } from "@/lib/dates/formatDateWithWeekday";
import { AppConfig, LandingContent, getLandingContent } from "@/config/content";

type RosterData = NonNullable<
  FunctionReturnType<typeof api.attendeeProfiles.listRoster>
>;
type RosterMember = RosterData["members"][number];

const TRAVEL_MODE_SHORT: Record<TravelMode, { icon: string; label: string }> = {
  driving_own_vehicle: { icon: "🚗", label: "Driving" },
  riding_with_attendee: { icon: "🚗", label: "Riding along" },
  burner_express: { icon: "🚌", label: "Burner Express" },
  flying: { icon: "✈️", label: "Flying" },
  not_sure: { icon: "🤷", label: "Travel TBD" },
};

const SLEEPING_SHORT: Record<SleepingType, string> = {
  rv_trailer_vehicle: "RV / vehicle",
  own_shiftpod_or_tent: "Own shiftpod/tent",
  need_camp_shiftpod: "Camp shiftpod",
};


const AVATAR_COLORS = [
  "bg-emerald-500/80",
  "bg-teal-500/80",
  "bg-cyan-500/80",
  "bg-sky-500/80",
  "bg-violet-500/80",
  "bg-fuchsia-500/80",
  "bg-rose-500/80",
  "bg-amber-500/80",
];

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function avatarColor(fullName: string): string {
  let hash = 0;
  for (let i = 0; i < fullName.length; i++) {
    hash = (hash * 31 + fullName.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** "Sat, Aug 22" without the year — group headers repeat it enough already. */
function shortDay(dateValue: string): string {
  const parts = dateValue.split("-").map(Number);
  if (parts.length !== 3 || !parts.every(Number.isFinite)) {
    return dateValue;
  }
  const [year, month, day] = parts;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-5 ring-1 ring-white/10">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-400">{detail}</p>}
    </div>
  );
}

function MemberCard({ member }: { member: RosterMember }) {
  const travel = member.arrivalMode ? TRAVEL_MODE_SHORT[member.arrivalMode] : undefined;
  const sleeping = member.sleepingType ? SLEEPING_SHORT[member.sleepingType] : undefined;

  return (
    <div
      className={`rounded-2xl bg-white/5 backdrop-blur-sm p-4 ring-1 transition-colors ${
        member.isViewer ? "ring-emerald-400/50" : "ring-white/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(member.fullName)}`}
        >
          {initials(member.fullName)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {member.fullName}
            {member.isViewer && <span className="ml-1.5 text-xs font-normal text-emerald-300">(you)</span>}
          </p>
          {member.playaName ? (
            <p className="truncate text-base font-bold tracking-wide text-emerald-300">
              &ldquo;{member.playaName}&rdquo;
            </p>
          ) : (
            <p className="truncate text-xs italic text-slate-500">no playa name yet</p>
          )}
        </div>
        {member.memberType === "newbie" && (
          <span className="ml-auto shrink-0 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-amber-400/30">
            Newbie
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
        <span title={`${formatDateWithWeekday(member.arrival)} → ${formatDateWithWeekday(member.departure)}`}>
          📅 {shortDay(member.arrival)} → {shortDay(member.departure)}
        </span>
        {travel && (
          <span>
            {travel.icon} {travel.label}
            {member.vehicleName ? ` · ${member.vehicleName}` : ""}
          </span>
        )}
        {sleeping && (
          <span>
            ⛺ {member.sleepingPlace ?? sleeping}
          </span>
        )}
        {typeof member.numBurnsAttended === "number" && (
          <span>
            🔥{" "}
            {member.numBurnsAttended === 0
              ? "First burn"
              : `${member.numBurnsAttended} ${member.numBurnsAttended === 1 ? "burn" : "burns"}`}
          </span>
        )}
      </div>
    </div>
  );
}

function ProfileNudge({ content }: { content: LandingContent }) {
  const mine = useQuery(api.attendeeProfiles.getMine);
  if (!mine) {
    return null;
  }

  const completeness = computeProfileCompleteness(
    mine.profile,
    mine.application,
    content.departureCutoff
  );
  if (completeness.completeCount === completeness.totalCount) {
    return null;
  }

  return (
    <Link
      href="/profile"
      className="flex items-center justify-between gap-4 rounded-2xl bg-amber-400/10 p-4 ring-1 ring-amber-400/30 transition-colors hover:bg-amber-400/15"
    >
      <p className="text-sm text-amber-200">
        Your profile is {completeness.completeCount} of {completeness.totalCount} sections
        complete — fill in the rest so campmates know your plans.
      </p>
      <span className="shrink-0 text-sm font-semibold text-amber-300">Finish it →</span>
    </Link>
  );
}

type RosterView = "arrival" | "departure" | "name";

const ROSTER_VIEWS: { key: RosterView; label: string }[] = [
  { key: "arrival", label: "Arrival day" },
  { key: "departure", label: "Departure day" },
  { key: "name", label: "First name" },
];

function RosterViewToggle({
  view,
  onChange,
}: {
  view: RosterView;
  onChange: (view: RosterView) => void;
}) {
  return (
    <div className="flex rounded-lg bg-white/5 p-1 ring-1 ring-white/10">
      {ROSTER_VIEWS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          aria-pressed={view === key}
          onClick={() => onChange(key)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === key
              ? "bg-emerald-500 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Roster({ content }: { content: LandingContent }) {
  const data = useQuery(api.attendeeProfiles.listRoster);
  const [view, setView] = useState<RosterView>("arrival");

  if (data === undefined) {
    return <Spinner />;
  }

  if (data === null) {
    return (
      <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10 text-center">
        <h2 className="text-xl font-semibold text-white">No Active Application</h2>
        <p className="mt-2 text-slate-400 max-w-sm mx-auto">
          The camp dashboard becomes available once you have an active application.
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

  const { members, stats } = data;

  const daysToGate = dayjs(content.burningManStartDate).diff(dayjs().startOf("day"), "day");

  // Members arrive sorted by arrival, then name. Regroup/resort per view.
  const groups = new Map<string, RosterMember[]>();
  if (view === "name") {
    groups.set(
      "everyone",
      [...members].sort((a, b) => a.fullName.localeCompare(b.fullName))
    );
  } else {
    const sorted =
      view === "departure"
        ? [...members].sort(
            (a, b) =>
              a.departure.localeCompare(b.departure) ||
              a.fullName.localeCompare(b.fullName)
          )
        : members;
    for (const member of sorted) {
      const key = view === "departure" ? member.departure : member.arrival;
      const group = groups.get(key) ?? [];
      group.push(member);
      groups.set(key, group);
    }
  }

  return (
    <div className="space-y-8">
      <ProfileNudge content={content} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label="Days to gate"
          value={daysToGate > 0 ? String(daysToGate) : "It's on!"}
          detail={content.burningManDates}
        />
        <StatTile
          label="Confirmed campmates"
          value={String(stats.confirmedCount)}
          detail={`${stats.alumniCount} alumni · ${stats.newbieCount} newbies`}
        />
      </div>

      {members.length === 0 ? (
        <div className="rounded-2xl bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10 text-center">
          <p className="text-slate-400">
            No confirmed campmates yet — check back as reservations roll in.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Who&apos;s coming</h2>
            <RosterViewToggle view={view} onChange={setView} />
          </div>
          {[...groups.entries()].map(([key, group]) => (
            <section key={key}>
              {view !== "name" && (
                <div className="mb-3 flex items-baseline gap-3">
                  <h3 className="text-sm font-semibold text-emerald-300">
                    {formatDateWithWeekday(key)}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {group.length}{" "}
                    {view === "departure"
                      ? group.length === 1
                        ? "departure"
                        : "departures"
                      : group.length === 1
                        ? "arrival"
                        : "arrivals"}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.map((member) => (
                  <MemberCard key={member.applicationId} member={member} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
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
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="mb-10 flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
              {content.campName}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Camp Dashboard
            </h1>
            <p className="mt-3 text-slate-300">
              Your minty oasis at a glance — who&apos;s coming, when, and how.
            </p>
            <div className="mt-4 flex gap-4 text-sm">
              <Link href="/profile" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                My attendee profile →
              </Link>
              <Link href="/apply" className="text-slate-400 hover:text-white transition-colors">
                My application →
              </Link>
            </div>
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
            <h2 className="text-xl font-semibold text-white">Sign in to see the roster</h2>
            <p className="mt-2 text-slate-400 max-w-sm mx-auto">
              The camp dashboard is for {content.campName} members.
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
            <Roster content={content} />
          </ErrorBoundary>
        </Authenticated>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        redirectTo="/dashboard"
      />
    </main>
  );
}
