"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import clsx from "clsx";

const EVENT_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  form_submitted: { bg: "bg-blue-500/20", text: "text-blue-400" },
  invalid_departure: { bg: "bg-amber-500/20", text: "text-amber-400" },
  payment_initiated: { bg: "bg-purple-500/20", text: "text-purple-400" },
  payment_success: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  payment_failed: { bg: "bg-red-500/20", text: "text-red-400" },
  ops_override_granted: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  ops_override_denied: { bg: "bg-red-500/20", text: "text-red-400" },
  webhook_error: { bg: "bg-red-500/20", text: "text-red-400" },
  mutation_failed: { bg: "bg-red-500/20", text: "text-red-400" },
};

const EVENT_TYPES = [
  "form_submitted",
  "invalid_departure",
  "payment_initiated",
  "payment_success",
  "payment_failed",
  "ops_override_granted",
  "ops_override_denied",
  "webhook_error",
  "mutation_failed",
] as const;

type EventType = (typeof EVENT_TYPES)[number];

export function EventLogTable() {
  const [selectedType, setSelectedType] = useState<EventType | "all">("all");
  const [limit, setLimit] = useState(50);

  const recentEvents = useQuery(api.eventLogs.listRecent, { limit });
  const filteredEvents = useQuery(
    api.eventLogs.getByEventType,
    selectedType !== "all" ? { eventType: selectedType, limit } : "skip"
  );

  const events = selectedType === "all" ? recentEvents : filteredEvents;

  if (events === undefined) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-slate-400">Loading events...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as EventType | "all")}
          className="bg-white/5 border-0 rounded-lg px-4 py-2 text-sm text-white ring-1 ring-white/10 focus:ring-emerald-500"
        >
          <option value="all">All Events</option>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="bg-white/5 border-0 rounded-lg px-4 py-2 text-sm text-white ring-1 ring-white/10 focus:ring-emerald-500"
        >
          <option value={25}>25 events</option>
          <option value={50}>50 events</option>
          <option value={100}>100 events</option>
        </select>
      </div>

      {/* Table */}
      {events.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-white/5 ring-1 ring-white/10">
          <p className="text-slate-400">No events found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
          <table className="min-w-full divide-y divide-white/10">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actor
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.map((event) => {
                const styles = EVENT_TYPE_STYLES[event.eventType] || {
                  bg: "bg-slate-500/20",
                  text: "text-slate-400",
                };
                let payload: Record<string, unknown> = {};
                try {
                  payload = JSON.parse(event.payload);
                } catch {
                  // Ignore parse errors
                }

                return (
                  <tr
                    key={event._id}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-300">
                        {new Date(event.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={clsx(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          styles.bg,
                          styles.text
                        )}
                      >
                        {event.eventType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-400">{event.actor}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-400 max-w-md truncate">
                        {!!payload.email && (
                          <span className="text-white">{String(payload.email)}</span>
                        )}
                        {!!payload.error && (
                          <span className="text-red-400"> {String(payload.error)}</span>
                        )}
                        {!!payload.reason && (
                          <span> - {String(payload.reason)}</span>
                        )}
                        {!payload.email && !payload.error && !payload.reason && (
                          <span className="text-slate-500">
                            {event.payload.substring(0, 100)}...
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
