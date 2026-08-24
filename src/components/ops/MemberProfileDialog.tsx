"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import clsx from "clsx";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { PhotoLightbox } from "../PhotoLightbox";
import { getStatusBadge } from "./statusBadge";
import { formatDateWithWeekday } from "../../lib/dates/formatDateWithWeekday";
import { formatPhoneDisplay } from "../../lib/phone/format";
import {
  BIKE_STATUS_LABELS,
  DIETARY_PREFERENCE_LABELS,
  SLEEPING_TYPE_LABELS,
  TRAVEL_MODE_LABELS,
  VEHICLE_PASS_STATUS_LABELS,
} from "../../lib/attendeeProfile/options";

/**
 * The subset of an ops members row this dialog needs. Structural, so the
 * members table can hand over its own row type without exporting it.
 */
export interface MemberProfileDialogRow {
  _source?: "signup" | "invite";
  applicationId?: string;
  fullName: string;
  email: string;
  phone: string;
  arrival: string;
  arrivalTime: string;
  departure: string;
  departureTime: string;
  status: string;
  memberType?: "alumni" | "newbie";
  hasFullPayment?: boolean;
  cancelled?: boolean;
  sponsorName?: string;
  requests: string;
  addedBy?: string;
  notes?: string;
}

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
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

function avatarColor(fullName: string): string {
  let hash = 0;
  for (let i = 0; i < fullName.length; i++) {
    hash = (hash * 31 + fullName.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function label<T extends string>(labels: Record<T, string>, value: T | undefined): string {
  return value ? (labels[value] ?? value) : "—";
}

function yesNo(value: boolean | undefined): string {
  if (value === undefined) return "—";
  return value ? "Yes" : "No";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <dl className="mt-3 space-y-2">{children}</dl>
    </section>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-32 shrink-0 text-slate-500">{term}</dt>
      <dd className="min-w-0 flex-1 break-words text-slate-200">{children}</dd>
    </div>
  );
}

export function MemberProfileDialog({
  row,
  opsPassword,
  onClose,
}: {
  row: MemberProfileDialogRow;
  opsPassword: string;
  onClose: () => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // A drag that starts on the panel and ends on the backdrop fires its click
  // on the backdrop (the common ancestor), so checking the click target alone
  // would dismiss the dialog mid text-selection. Require the press to have
  // started on the backdrop too.
  const pressedBackdrop = useRef(false);

  // Unclaimed manual invites have no application yet, so there is no profile
  // to fetch — the row itself is everything ops knows about them.
  const profile = useQuery(
    api.attendeeProfiles.getForOps,
    row.applicationId
      ? { opsPassword, applicationId: row.applicationId as Id<"applications"> }
      : "skip"
  );
  const loading = row.applicationId !== undefined && profile === undefined;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      // The lightbox sits on top and closes itself first.
      if (event.key === "Escape" && !lightboxOpen) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, lightboxOpen]);

  const badge = row.cancelled
    ? { label: "Cancelled", cls: "bg-red-500/15 text-red-300 ring-red-400/30" }
    : getStatusBadge(row.status);
  const photoUrl = profile?.photoUrl ?? null;
  const playaName = profile?.playaName;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Profile: ${row.fullName}`}
      onMouseDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-3xl rounded-xl bg-slate-950 p-5 shadow-2xl ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex min-w-0 items-center gap-4">
            {photoUrl ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label={`Enlarge ${row.fullName}'s photo`}
                className="shrink-0 rounded-full ring-1 ring-white/20 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs are dynamic; next/image needs remotePatterns config */}
                <img
                  src={photoUrl}
                  alt={`${row.fullName}'s photo`}
                  className="h-20 w-20 rounded-full object-cover"
                />
              </button>
            ) : (
              <div
                className={clsx(
                  "flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white",
                  avatarColor(row.fullName)
                )}
                title={loading ? "Loading photo…" : "No photo uploaded"}
              >
                {initials(row.fullName)}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold text-white">{row.fullName}</h2>
              {playaName && (
                <p className="truncate text-base font-bold tracking-wide text-emerald-300">
                  &ldquo;{playaName}&rdquo;
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className={clsx(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                    badge.cls
                  )}
                >
                  {badge.label}
                </span>
                <span
                  className={clsx(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                    row.memberType === "newbie"
                      ? "bg-sky-500/10 text-sky-200 ring-sky-400/30"
                      : "bg-amber-500/10 text-amber-200 ring-amber-400/30"
                  )}
                >
                  {row.memberType === "newbie" ? "Newbie" : "Alumni"}
                </span>
                <span
                  className={clsx(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                    row.hasFullPayment
                      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                      : "bg-slate-500/10 text-slate-400 ring-slate-400/20"
                  )}
                >
                  {row.hasFullPayment ? "Paid in Full" : "Payment Outstanding"}
                </span>
                {profile && (
                  <span
                    className={clsx(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                      profile.completeCount === profile.totalCount
                        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                        : "bg-amber-500/15 text-amber-300 ring-amber-400/30"
                    )}
                    title={
                      profile.missingSections.length
                        ? `Missing: ${profile.missingSections.join(", ")}`
                        : "All profile sections complete"
                    }
                  >
                    Profile {profile.completeCount}/{profile.totalCount}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-white/20"
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Section title="Contact">
              <Row term="Email">
                <a href={`mailto:${row.email}`} className="text-emerald-300 hover:text-emerald-200">
                  {row.email}
                </a>
              </Row>
              <Row term="Phone">{formatPhoneDisplay(row.phone) || "—"}</Row>
              {row.sponsorName && <Row term="Sponsor">{row.sponsorName}</Row>}
              {row.addedBy && <Row term="Added by">{row.addedBy}</Row>}
            </Section>

            <Section title="Dates">
              <Row term="Arrival">
                {formatDateWithWeekday(row.arrival)}
                <span className="block text-xs text-slate-500">{row.arrivalTime}</span>
              </Row>
              <Row term="Departure">
                {formatDateWithWeekday(row.departure)}
                <span className="block text-xs text-slate-500">{row.departureTime}</span>
              </Row>
              {profile?.earlyDepartureRequested && (
                <Row term="Early departure">{profile.earlyDepartureReason ?? "Requested"}</Row>
              )}
            </Section>

            <Section title="Travel">
              <Row term="Arrival mode">
                {label(TRAVEL_MODE_LABELS, profile?.arrivalMode)}
              </Row>
              <Row term="Departure mode">
                {label(TRAVEL_MODE_LABELS, profile?.departureMode)}
              </Row>
              <Row term="Vehicle">
                {profile?.vehicleName ?? "—"}
                {profile?.vehicleLengthFt ? (
                  <span className="text-xs text-slate-500"> · {profile.vehicleLengthFt} ft</span>
                ) : null}
              </Row>
              <Row term="Vehicle pass">
                {label(VEHICLE_PASS_STATUS_LABELS, profile?.vehiclePassStatus)}
              </Row>
              <Row term="Bike">{label(BIKE_STATUS_LABELS, profile?.bikeStatus)}</Row>
            </Section>

            <Section title="Sleeping">
              <Row term="Type">{label(SLEEPING_TYPE_LABELS, profile?.sleepingType)}</Row>
              <Row term="Sleeping in">{profile?.sleepingPlace ?? "—"}</Row>
            </Section>

            <Section title="Meals">
              <Row term="Dietary">
                {profile
                  ? (DIETARY_PREFERENCE_LABELS[profile.dietaryPreference] ??
                    profile.dietaryPreference)
                  : "—"}
              </Row>
              <Row term="Allergies">
                {profile?.allergyFlag ? (profile.allergyNotes ?? "Yes") : "None noted"}
              </Row>
            </Section>

            <Section title="Burning Man">
              <Row term="Has ticket">{yesNo(profile?.hasTicket)}</Row>
              <Row term="Burns attended">
                {profile?.numBurnsAttended === undefined
                  ? "—"
                  : profile.numBurnsAttended === 0
                    ? "First burn"
                    : String(profile.numBurnsAttended)}
              </Row>
            </Section>

            <Section title="Emergency contact">
              <Row term="Name">{profile?.emergencyContactName ?? "—"}</Row>
              <Row term="Phone">
                {profile?.emergencyContactPhone
                  ? formatPhoneDisplay(profile.emergencyContactPhone)
                  : "—"}
              </Row>
              <Row term="Email">{profile?.emergencyContactEmail ?? "—"}</Row>
            </Section>

            <Section title="Notes">
              <Row term="Requests">{profile?.requests || row.requests || "—"}</Row>
              {row.notes && <Row term="Ops notes">{row.notes}</Row>}
            </Section>

            {profile && profile.missingSections.length > 0 && (
              <div className="sm:col-span-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200 ring-1 ring-amber-400/30">
                Profile still missing: {profile.missingSections.join(", ")}
              </div>
            )}

            {!row.applicationId && (
              <p className="sm:col-span-2 text-sm text-slate-400">
                This member was invited manually and hasn&apos;t claimed their invite yet, so
                there is no attendee profile or photo to show.
              </p>
            )}

            {row.applicationId && profile === null && (
              <p className="sm:col-span-2 text-sm text-slate-400">
                Their application record could not be loaded.
              </p>
            )}
          </div>
        )}
      </div>

      {lightboxOpen && photoUrl && (
        <PhotoLightbox
          src={photoUrl}
          alt={`${row.fullName}'s photo`}
          caption={playaName ? `${row.fullName} — “${playaName}”` : row.fullName}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
