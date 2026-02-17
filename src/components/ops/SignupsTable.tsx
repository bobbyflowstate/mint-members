"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

function formatDateForDisplay(dateValue: string | undefined) {
  if (!dateValue) {
    return "Not specified";
  }

  const parts = dateValue.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    if ([year, month, day].every(Number.isFinite)) {
      return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }

  return dateValue;
}

export function SignupsTable() {
  // Pull full application docs so ops can see attendance fields even if the
  // lightweight signup projection is stale in an older backend deployment.
  const applications = useQuery(api.applications.list, { limit: 5000 });

  if (applications === undefined) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-slate-400">Loading signups...</p>
      </div>
    );
  }

  const signups = [...applications].sort(
    (a, b) => (b.createdAt ?? b._creationTime) - (a.createdAt ?? a._creationTime)
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-6">
        <div className="text-sm text-slate-400">Total Signups</div>
        <div className="mt-1 text-3xl font-bold text-white">{signups.length}</div>
        <p className="mt-2 text-xs text-slate-500">Ordered by creation date (newest first).</p>
      </div>

      {signups.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-white/5 ring-1 ring-white/10">
          <p className="text-slate-400">No signups yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
          <table className="min-w-full divide-y divide-white/10">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  First Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Last Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Phone #
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Arrival (Date / Time)
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Departure (Date / Time)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {signups.map((signup) => (
                <tr key={signup._id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {signup.firstName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {signup.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {signup.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {signup.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {formatDateForDisplay(signup.arrival)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {signup.arrivalTime ?? "Not specified"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {formatDateForDisplay(signup.departure)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {signup.departureTime ?? "Not specified"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
