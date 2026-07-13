"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import clsx from "clsx";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { buildSignupCsv, downloadCsv, CsvColumn } from "../../lib/opsSignupsView/csv";
import {
  BIKE_STATUS_LABELS,
  DIETARY_PREFERENCE_LABELS,
  SLEEPING_TYPE_LABELS,
  TRAVEL_MODE_LABELS,
  VEHICLE_PASS_STATUS_LABELS,
} from "../../lib/attendeeProfile/options";

const OPS_PASSWORD_KEY = "ops_password";

type ProfileRow = FunctionReturnType<typeof api.attendeeProfiles.listForOps>[number];

type CompletionTab = "all" | "incomplete" | "complete";

function label<T extends string>(
  labels: Record<T, string>,
  value: T | undefined
): string {
  return value ? (labels[value] ?? value) : "—";
}

function yesNo(value: boolean | undefined): string {
  if (value === undefined) return "—";
  return value ? "Yes" : "No";
}

const CSV_COLUMNS: CsvColumn<ProfileRow>[] = [
  { key: "fullName", header: "Name", getValue: (r) => r.fullName },
  { key: "playaName", header: "Playa Name", getValue: (r) => r.playaName ?? "" },
  { key: "email", header: "Email", getValue: (r) => r.email },
  { key: "phone", header: "Phone", getValue: (r) => r.phone },
  { key: "memberType", header: "Member Type", getValue: (r) => r.memberType },
  { key: "status", header: "Status", getValue: (r) => r.status },
  {
    key: "completeness",
    header: "Profile Complete",
    getValue: (r) => `${r.completeCount}/${r.totalCount}`,
  },
  {
    key: "missing",
    header: "Missing Sections",
    getValue: (r) => r.missingSections.join("; "),
  },
  { key: "hasTicket", header: "Has Ticket", getValue: (r) => yesNo(r.hasTicket) },
  {
    key: "numBurns",
    header: "Burns Attended",
    getValue: (r) => (r.numBurnsAttended === undefined ? "" : String(r.numBurnsAttended)),
  },
  { key: "arrival", header: "Arrival", getValue: (r) => r.arrival },
  { key: "arrivalTime", header: "Arrival Window", getValue: (r) => r.arrivalTime },
  { key: "departure", header: "Departure", getValue: (r) => r.departure },
  { key: "departureTime", header: "Departure Window", getValue: (r) => r.departureTime },
  {
    key: "earlyDeparture",
    header: "Early Departure",
    getValue: (r) => (r.earlyDepartureRequested ? (r.earlyDepartureReason ?? "yes") : ""),
  },
  {
    key: "arrivalMode",
    header: "Arrival Mode",
    getValue: (r) => label(TRAVEL_MODE_LABELS, r.arrivalMode),
  },
  {
    key: "departureMode",
    header: "Departure Mode",
    getValue: (r) => label(TRAVEL_MODE_LABELS, r.departureMode),
  },
  { key: "vehicle", header: "Vehicle", getValue: (r) => r.vehicleName ?? "" },
  {
    key: "vehicleLength",
    header: "Vehicle Length (ft)",
    getValue: (r) => (r.vehicleLengthFt === undefined ? "" : String(r.vehicleLengthFt)),
  },
  {
    key: "vehiclePass",
    header: "Vehicle Pass",
    getValue: (r) => label(VEHICLE_PASS_STATUS_LABELS, r.vehiclePassStatus),
  },
  {
    key: "bike",
    header: "Bike",
    getValue: (r) => label(BIKE_STATUS_LABELS, r.bikeStatus),
  },
  {
    key: "sleepingType",
    header: "Sleeping",
    getValue: (r) => label(SLEEPING_TYPE_LABELS, r.sleepingType),
  },
  { key: "sleepingPlace", header: "Sleeping In", getValue: (r) => r.sleepingPlace ?? "" },
  {
    key: "dietary",
    header: "Dietary",
    getValue: (r) => DIETARY_PREFERENCE_LABELS[r.dietaryPreference] ?? r.dietaryPreference,
  },
  { key: "allergies", header: "Allergies", getValue: (r) => (r.allergyFlag ? (r.allergyNotes ?? "yes") : "") },
  { key: "ecName", header: "Emergency Contact", getValue: (r) => r.emergencyContactName ?? "" },
  { key: "ecPhone", header: "Emergency Phone", getValue: (r) => r.emergencyContactPhone ?? "" },
  { key: "ecEmail", header: "Emergency Email", getValue: (r) => r.emergencyContactEmail ?? "" },
  { key: "requests", header: "Requests", getValue: (r) => r.requests ?? "" },
];

export function ProfilesTable() {
  const [opsPassword] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(OPS_PASSWORD_KEY) : null
  );
  const [tab, setTab] = useState<CompletionTab>("all");
  const [search, setSearch] = useState("");

  const rows = useQuery(
    api.attendeeProfiles.listForOps,
    opsPassword ? { opsPassword } : "skip"
  );

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    const term = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (tab === "incomplete" && row.completeCount === row.totalCount) return false;
        if (tab === "complete" && row.completeCount !== row.totalCount) return false;
        if (!term) return true;
        return (
          row.fullName.toLowerCase().includes(term) ||
          row.email.toLowerCase().includes(term) ||
          (row.playaName ?? "").toLowerCase().includes(term) ||
          (row.vehicleName ?? "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        // Least-complete first within tabs so ops sees who to chase.
        if (a.completeCount !== b.completeCount) {
          return a.completeCount - b.completeCount;
        }
        return a.fullName.localeCompare(b.fullName);
      });
  }, [rows, tab, search]);

  const completeCount = rows?.filter((r) => r.completeCount === r.totalCount).length ?? 0;

  const handleExport = () => {
    const csv = buildSignupCsv(filteredRows, CSV_COLUMNS);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`attendee-profiles-${stamp}.csv`, csv);
  };

  if (!opsPassword) {
    return <p className="text-sm text-slate-400">Enter the ops password to view profiles.</p>;
  }

  if (rows === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(
            [
              { id: "all", name: `All (${rows.length})` },
              { id: "incomplete", name: `Incomplete (${rows.length - completeCount})` },
              { id: "complete", name: `Complete (${completeCount})` },
            ] as { id: CompletionTab; name: string }[]
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-all",
                tab === item.id
                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                  : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"
              )}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, vehicle…"
            className="rounded-lg border-0 bg-white/5 px-3 py-1.5 text-sm text-white ring-1 ring-inset ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleExport}
            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 transition-all"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr>
              {[
                "Name",
                "Complete",
                "Ticket",
                "Burns",
                "Arrival Mode",
                "Departure Mode",
                "Vehicle",
                "Pass",
                "Bike",
                "Sleeping",
                "Dietary",
                "Allergies",
                "Emergency Contact",
                "Requests",
              ].map((header) => (
                <th
                  key={header}
                  className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredRows.map((row) => {
              const complete = row.completeCount === row.totalCount;
              return (
                <tr key={row.applicationId} className="hover:bg-white/5">
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <p className="font-medium text-white">
                      {row.fullName}
                      {row.playaName ? (
                        <span className="ml-1.5 text-xs text-emerald-300">
                          “{row.playaName}”
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-400">{row.email}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      title={
                        complete ? "All sections complete" : `Missing: ${row.missingSections.join(", ")}`
                      }
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-xs ring-1",
                        complete
                          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                          : "bg-amber-500/15 text-amber-300 ring-amber-400/30"
                      )}
                    >
                      {row.completeCount}/{row.totalCount}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {yesNo(row.hasTicket)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {row.numBurnsAttended ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {label(TRAVEL_MODE_LABELS, row.arrivalMode)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {label(TRAVEL_MODE_LABELS, row.departureMode)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {row.vehicleName ?? "—"}
                    {row.vehicleLengthFt ? (
                      <span className="text-xs text-slate-500"> · {row.vehicleLengthFt} ft</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {label(VEHICLE_PASS_STATUS_LABELS, row.vehiclePassStatus)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {label(BIKE_STATUS_LABELS, row.bikeStatus)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {label(SLEEPING_TYPE_LABELS, row.sleepingType)}
                    {row.sleepingPlace ? (
                      <span className="text-xs text-slate-500"> · {row.sleepingPlace}</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {DIETARY_PREFERENCE_LABELS[row.dietaryPreference] ?? row.dietaryPreference}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2.5 text-slate-300" title={row.allergyNotes}>
                    {row.allergyFlag ? (row.allergyNotes ?? "Yes") : "No"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {row.emergencyContactName ? (
                      <>
                        {row.emergencyContactName}
                        <span className="block text-xs text-slate-500">
                          {row.emergencyContactPhone}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-2.5 text-slate-300" title={row.requests}>
                    {row.requests ?? "—"}
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-sm text-slate-500">
                  No profiles match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
