"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import clsx from "clsx";

function formatDateForDisplay(
  dateValue: string | undefined,
  options?: { includeWeekday?: boolean }
) {
  if (!dateValue) {
    return "Not specified";
  }

  const { includeWeekday = false } = options ?? {};

  const parts = dateValue.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    if ([year, month, day].every(Number.isFinite)) {
      return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        ...(includeWeekday ? { weekday: "short" } : {}),
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }

  return dateValue;
}

interface DateStat {
  date: string;
  count: number;
}

function buildDateStats(dateValues: Array<string | undefined>) {
  const counts = new Map<string, number>();

  for (const dateValue of dateValues) {
    if (!dateValue) {
      continue;
    }
    counts.set(dateValue, (counts.get(dateValue) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface DateFilterSectionProps {
  title: string;
  emptyMessage: string;
  stats: DateStat[];
  selectedDates: string[];
  onToggleDate: (date: string) => void;
  selectedClassName: string;
}

function DateFilterSection({
  title,
  emptyMessage,
  stats,
  selectedDates,
  onToggleDate,
  selectedClassName,
}: DateFilterSectionProps) {
  return (
    <div className="rounded-xl bg-black/20 ring-1 ring-white/10 p-4">
      <h3 className="text-xs font-semibold tracking-wide uppercase text-slate-300">{title}</h3>
      {stats.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {stats.map((stat) => {
            const isSelected = selectedDates.includes(stat.date);
            return (
              <button
                key={stat.date}
                type="button"
                onClick={() => onToggleDate(stat.date)}
                aria-pressed={isSelected}
                className={clsx(
                  "rounded-lg px-3 py-2 text-left transition-colors ring-1",
                  isSelected
                    ? selectedClassName
                    : "ring-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
                )}
              >
                <div className="text-xs">
                  {formatDateForDisplay(stat.date, { includeWeekday: true })}
                </div>
                <div className="mt-1 text-lg font-semibold">{stat.count}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SignupsTable() {
  // Pull full application docs so ops can see attendance fields even if the
  // lightweight signup projection is stale in an older backend deployment.
  const applications = useQuery(api.applications.list, { limit: 5000 });
  const [selectedArrivalDates, setSelectedArrivalDates] = useState<string[]>([]);
  const [selectedDepartureDates, setSelectedDepartureDates] = useState<string[]>([]);
  const signups = useMemo(() => {
    if (!applications) {
      return [];
    }

    return [...applications].sort(
      (a, b) => (b.createdAt ?? b._creationTime) - (a.createdAt ?? a._creationTime)
    );
  }, [applications]);

  const arrivalStats = useMemo(
    () => buildDateStats(signups.map((signup) => signup.arrival)),
    [signups]
  );
  const departureStats = useMemo(
    () => buildDateStats(signups.map((signup) => signup.departure)),
    [signups]
  );

  const filteredSignups = useMemo(() => {
    return signups.filter((signup) => {
      const matchesArrival =
        selectedArrivalDates.length === 0 ||
        (signup.arrival ? selectedArrivalDates.includes(signup.arrival) : false);
      const matchesDeparture =
        selectedDepartureDates.length === 0 ||
        (signup.departure ? selectedDepartureDates.includes(signup.departure) : false);

      return matchesArrival && matchesDeparture;
    });
  }, [signups, selectedArrivalDates, selectedDepartureDates]);

  const hasActiveFilters =
    selectedArrivalDates.length > 0 || selectedDepartureDates.length > 0;

  const toggleArrivalDate = (date: string) => {
    setSelectedArrivalDates((previousSelection) =>
      previousSelection.includes(date)
        ? previousSelection.filter((selectedDate) => selectedDate !== date)
        : [...previousSelection, date]
    );
  };

  const toggleDepartureDate = (date: string) => {
    setSelectedDepartureDates((previousSelection) =>
      previousSelection.includes(date)
        ? previousSelection.filter((selectedDate) => selectedDate !== date)
        : [...previousSelection, date]
    );
  };

  const clearAllDateFilters = () => {
    setSelectedArrivalDates([]);
    setSelectedDepartureDates([]);
  };

  if (applications === undefined) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-slate-400">Loading signups...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-6">
        <div className="text-sm text-slate-400">Total Signups</div>
        <div className="mt-1 text-3xl font-bold text-white">{signups.length}</div>
        <p className="mt-2 text-xs text-slate-500">
          {hasActiveFilters
            ? `Showing ${filteredSignups.length} of ${signups.length} signups by selected dates.`
            : "Ordered by creation date (newest first)."}
        </p>
      </div>

      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Date Breakdown</h2>
            <p className="mt-1 text-xs text-slate-400">
              Select one or more arrival and departure dates to filter signups.
            </p>
          </div>
          <button
            type="button"
            onClick={clearAllDateFilters}
            disabled={!hasActiveFilters}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              hasActiveFilters
                ? "bg-white/10 text-slate-200 hover:bg-white/20"
                : "bg-white/5 text-slate-500 cursor-not-allowed"
            )}
          >
            Clear selections
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <DateFilterSection
            title="Arrival Dates"
            emptyMessage="No arrival dates available yet."
            stats={arrivalStats}
            selectedDates={selectedArrivalDates}
            onToggleDate={toggleArrivalDate}
            selectedClassName="ring-emerald-400/50 bg-emerald-500/20 text-emerald-100"
          />
          <DateFilterSection
            title="Departure Dates"
            emptyMessage="No departure dates available yet."
            stats={departureStats}
            selectedDates={selectedDepartureDates}
            onToggleDate={toggleDepartureDate}
            selectedClassName="ring-sky-400/50 bg-sky-500/20 text-sky-100"
          />
        </div>
      </div>

      {signups.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-white/5 ring-1 ring-white/10">
          <p className="text-slate-400">No signups yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSignups.length === 0 ? (
            <div className="text-center py-12 rounded-xl bg-white/5 ring-1 ring-white/10">
              <p className="text-slate-400">No signups match the selected dates.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredSignups.map((signup) => (
                  <article
                    key={signup._id}
                    className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          {signup.firstName} {signup.lastName}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Created{" "}
                          {new Date(
                            signup.createdAt ?? signup._creationTime
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Email
                        </dt>
                        <dd className="text-slate-200 break-all">{signup.email}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Phone
                        </dt>
                        <dd className="text-slate-300">{signup.phone}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Arrival
                        </dt>
                        <dd className="text-slate-200">
                          {formatDateForDisplay(signup.arrival)}
                        </dd>
                        <dd className="text-xs text-slate-500">
                          {signup.arrivalTime ?? "Not specified"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Departure
                        </dt>
                        <dd className="text-slate-200">
                          {formatDateForDisplay(signup.departure)}
                        </dd>
                        <dd className="text-xs text-slate-500">
                          {signup.departureTime ?? "Not specified"}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>

              <div className="hidden md:block rounded-xl bg-white/5 ring-1 ring-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] divide-y divide-white/10">
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
                      {filteredSignups.map((signup) => (
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
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
