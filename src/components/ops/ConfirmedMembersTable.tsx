"use client";

import { useMemo } from "react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { formatDateWithWeekday } from "../../lib/dates/formatDateWithWeekday";

const OPS_PASSWORD_KEY = "ops_password";

interface ConfirmedMemberRow {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  memberType: "alumni" | "newbie";
  sponsorName?: string;
  requests: string;
  attendance: string;
  hasBurningManTicket: boolean;
  hasVehiclePass: boolean;
}

function formatAttendance(
  arrival: string,
  arrivalTime: string,
  departure: string,
  departureTime: string
) {
  return `${formatDateWithWeekday(arrival)} (${arrivalTime}) -> ${formatDateWithWeekday(
    departure
  )} (${departureTime})`;
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

export function ConfirmedMembersTable() {
  const [opsPassword] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(OPS_PASSWORD_KEY);
    }
    return null;
  });

  const confirmedMembers = useQuery(
    api.confirmedMembers.listForOps,
    opsPassword ? { opsPassword } : "skip"
  );

  const rows = useMemo<ConfirmedMemberRow[]>(() => {
    if (!confirmedMembers) return [];

    return confirmedMembers.map((member) => ({
      _id: member._id,
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
      memberType: member.memberType ?? "alumni",
      sponsorName: member.sponsorName,
      requests: member.requests,
      attendance: formatAttendance(
        member.arrival,
        member.arrivalTime,
        member.departure,
        member.departureTime
      ),
      hasBurningManTicket: member.hasBurningManTicket,
      hasVehiclePass: member.hasVehiclePass,
    }));
  }, [confirmedMembers]);

  if (!opsPassword || confirmedMembers === undefined) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-slate-400">Loading confirmed members...</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-6">
        <p className="text-slate-400">No confirmed members yet.</p>
      </div>
    );
  }

  return <ConfirmedMembersTableView rows={rows} />;
}

export function ConfirmedMembersTableView({ rows }: { rows: ConfirmedMemberRow[] }) {
  return (
    <div className="space-y-4">
      <div className="hidden md:block overflow-x-auto rounded-xl bg-white/5 ring-1 ring-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-300">
            <tr>
              <th className="px-4 py-3">Full Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone #</th>
              <th className="px-4 py-3">Member Type</th>
              <th className="px-4 py-3">Sponsor</th>
              <th className="px-4 py-3">Requests</th>
              <th className="px-4 py-3">Arrival / Departure</th>
              <th className="px-4 py-3">Has Burning Man Ticket</th>
              <th className="px-4 py-3">Has Vehicle Pass</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-slate-200">
            {rows.map((row) => {
              const hasRequests = row.requests.trim().length > 0;
              return (
                <tr key={row._id} className="align-top">
                  <td className="px-4 py-3 font-medium text-white">{row.fullName}</td>
                  <td className="px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.phone}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-200 ring-1 ring-sky-400/30">
                      {row.memberType === "newbie" ? "Newbie" : "Alumni"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.sponsorName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        hasRequests
                          ? "inline-flex rounded-md bg-amber-500/20 px-2 py-1 text-amber-200 ring-1 ring-amber-400/40"
                          : "text-slate-500"
                      }
                    >
                      {hasRequests ? row.requests : "None"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.attendance}</td>
                  <td className="px-4 py-3">{formatBoolean(row.hasBurningManTicket)}</td>
                  <td className="px-4 py-3">{formatBoolean(row.hasVehiclePass)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {rows.map((row) => {
          const hasRequests = row.requests.trim().length > 0;
          return (
            <article key={row._id} className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4 space-y-2">
              <h3 className="text-base font-semibold text-white">{row.fullName}</h3>
              <p className="text-sm text-slate-300">{row.email}</p>
              <p className="text-sm text-slate-300">{row.phone}</p>
              <p className="text-sm text-slate-300">
                Member Type: <span className="text-white">{row.memberType === "newbie" ? "Newbie" : "Alumni"}</span>
              </p>
              <p className="text-sm text-slate-300">
                Sponsor: <span className="text-white">{row.sponsorName ?? "—"}</span>
              </p>
              <p className="text-sm text-slate-300">{row.attendance}</p>
              <p className="text-sm text-slate-300">
                Has Burning Man Ticket:{" "}
                <span className="text-white">{formatBoolean(row.hasBurningManTicket)}</span>
              </p>
              <p className="text-sm text-slate-300">
                Has Vehicle Pass: <span className="text-white">{formatBoolean(row.hasVehiclePass)}</span>
              </p>
              <p
                className={
                  hasRequests
                    ? "text-sm rounded-md bg-amber-500/20 px-2 py-1 text-amber-200 ring-1 ring-amber-400/40"
                    : "text-sm text-slate-500"
                }
              >
                Requests: {hasRequests ? row.requests : "None"}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
