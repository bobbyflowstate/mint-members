"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildShiftAgenda,
  familyLabel,
  filterRowsForAgenda,
  getScheduleMetrics,
  parseTask,
} from "@/lib/shifts/agenda";
import type { AgendaCard } from "@/lib/shifts/agenda";
import type { ShiftRow } from "@/lib/shifts/types";

const FAMILY_STYLES: Record<string, { icon: string; accent: string; badge: string }> = {
  WATER: { icon: "💧", accent: "border-l-sky-400", badge: "bg-sky-400/10 text-sky-300" },
  MEAL: { icon: "🍽", accent: "border-l-orange-400", badge: "bg-orange-400/10 text-orange-300" },
  MEALS: { icon: "🍽", accent: "border-l-orange-400", badge: "bg-orange-400/10 text-orange-300" },
  BAR: { icon: "🍸", accent: "border-l-violet-400", badge: "bg-violet-400/10 text-violet-300" },
  LNT: { icon: "🌿", accent: "border-l-emerald-400", badge: "bg-emerald-400/10 text-emerald-300" },
  SOUND: { icon: "♫", accent: "border-l-pink-400", badge: "bg-pink-400/10 text-pink-300" },
  "BIKE PARK": { icon: "🚲", accent: "border-l-cyan-400", badge: "bg-cyan-400/10 text-cyan-300" },
  ICE: { icon: "❄", accent: "border-l-blue-200", badge: "bg-blue-200/10 text-blue-200" },
};
const FALLBACK_STYLE = {
  icon: "✦",
  accent: "border-l-slate-400",
  badge: "bg-slate-400/10 text-slate-300",
};

function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return {
    long: date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
    short: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  };
}

function TaskCard({ card, personQuery }: { card: AgendaCard; personQuery: string }) {
  const style = FAMILY_STYLES[card.family] ?? FALLBACK_STYLE;
  const normalizedQuery = personQuery.trim().toLocaleLowerCase();
  return (
    <article className={`shift-print-card rounded-2xl border-l-4 ${style.accent} bg-white/[0.055] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.075]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={`shift-print-family inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${style.badge}`}>
            <span aria-hidden="true">{style.icon}</span>{card.familyLabel}
          </span>
          <h3 className="shift-print-activity mt-2 text-base font-semibold text-white">{card.activity}</h3>
        </div>
        {card.assignments.some((assignment) => assignment.unassigned) && (
          <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300 ring-1 ring-amber-400/30">
            Open
          </span>
        )}
      </div>
      <div className="mt-4 divide-y divide-white/10">
        {card.assignments.map((assignment, index) => (
          <div key={`${assignment.role}-${assignment.assignee}-${index}`} className="shift-print-assignment flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
            <span className="shift-print-role text-xs font-medium text-slate-400">{assignment.role}</span>
            {normalizedQuery && assignment.assignee.toLocaleLowerCase().includes(normalizedQuery) ? (
              <mark className="rounded-md bg-emerald-400/20 px-1.5 py-0.5 text-right text-sm font-bold text-emerald-200 ring-1 ring-emerald-400/30">
                {assignment.assignee}
              </mark>
            ) : (
              <span className={`text-right text-sm font-semibold ${assignment.unassigned ? "text-amber-300" : normalizedQuery ? "text-slate-400" : "text-slate-100"}`}>
                {assignment.assignee}
              </span>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

export function ShiftsTable({ rows }: { rows: ShiftRow[] }) {
  const [person, setPerson] = useState("");
  const [taskFamily, setTaskFamily] = useState("");
  const [activeDay, setActiveDay] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const agendaTopRef = useRef<HTMLDivElement>(null);
  const dayButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  const days = useMemo(() => [...new Set(rows.map((row) => row.date))].sort(), [rows]);
  const metrics = useMemo(() => getScheduleMetrics(rows), [rows]);
  const taskOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const row of rows) {
      const parsed = parseTask(row.task);
      options.set(familyLabel(parsed.family), parsed.family);
    }
    return [...options.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);
  const visibleRows = useMemo(() => {
    return filterRowsForAgenda(rows, { person, taskFamily, unassignedOnly });
  }, [rows, person, taskFamily, unassignedOnly]);
  const agenda = useMemo(() => buildShiftAgenda(visibleRows), [visibleRows]);
  const printDay = activeDay && agenda.some((day) => day.date === activeDay)
    ? activeDay
    : "";
  const printFilters = useMemo(() => {
    const filters: string[] = [];
    if (person.trim()) filters.push(`Person: ${person.trim()}`);
    if (taskFamily) filters.push(`Task: ${familyLabel(taskFamily)}`);
    if (unassignedOnly) filters.push("Unassigned shifts only");
    return filters;
  }, [person, taskFamily, unassignedOnly]);
  const printButtonLabel = printDay
    ? `Print ${dateParts(printDay).long}`
    : "Print filtered week";

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const date = visible[0]?.target.id.replace("day-", "");
        if (date) setActiveDay(date);
      },
      { rootMargin: "-120px 0px -65% 0px", threshold: 0 }
    );
    for (const day of agenda) {
      const section = document.getElementById(`day-${day.date}`);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [agenda]);

  useEffect(() => {
    if (activeDay) {
      dayButtonRefs.current.get(activeDay)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeDay]);

  const jumpToDay = (date: string) => {
    setActiveDay(date);
    document.getElementById(`day-${date}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const clear = () => {
    setPerson("");
    setTaskFamily("");
    setUnassignedOnly(false);
  };

  return (
    <div
      data-testid="print-root"
      data-print-scope={printDay ? "day" : "week"}
      className="shift-print-root space-y-8"
    >
      <header className="shift-print-only">
        <p className="shift-print-kicker">DeMentha 2026</p>
        <h1>Camp Shift Schedule</h1>
        <p>{printDay ? dateParts(printDay).long : "Filtered week"}</p>
        <p data-testid="print-summary">
          {printFilters.length > 0 ? printFilters.join(" · ") : "No filters applied"}
        </p>
      </header>

      <div ref={agendaTopRef} className="shift-no-print grid gap-4 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl bg-amber-400/[0.07] p-5 ring-1 ring-amber-400/20">
          <div className="absolute -right-5 -top-7 text-7xl opacity-[0.06]" aria-hidden="true">○</div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300/80">Spots unassigned</p>
          <p data-metric="unassigned" className="mt-2 text-3xl font-bold text-white">{metrics.unassignedSpots}</p>
          <p className="mt-1 text-xs text-slate-400">of {metrics.totalSpots} total spots</p>
        </div>
        <div className="rounded-2xl bg-emerald-400/[0.07] p-5 ring-1 ring-emerald-400/20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300/80">Filled spots</p>
              <p data-metric="filled-percent" className="mt-2 text-3xl font-bold text-white">{metrics.filledPercent}%</p>
            </div>
            <p className="pb-1 text-xs text-slate-400">{metrics.filledSpots} filled</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
              style={{ width: `${metrics.filledPercent}%` }}
              role="progressbar"
              aria-label="Filled spots"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={metrics.filledPercent}
            />
          </div>
        </div>
      </div>

      <div
        data-testid="sticky-schedule-controls"
        className="shift-no-print sticky top-0 z-10 -mx-4 flex items-center gap-2 border-y border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-3"
      >
        <nav aria-label="Schedule days" className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            aria-pressed={!activeDay}
            aria-label="Show all week"
            onClick={() => {
              setActiveDay("");
              agendaTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${!activeDay ? "bg-emerald-500 text-white shadow-lg shadow-emerald-950/30" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
          >
            All week
          </button>
          {days.map((date) => {
            const label = dateParts(date);
            const active = activeDay === date;
            return (
              <button
                key={date}
                type="button"
                ref={(element) => {
                  if (element) dayButtonRefs.current.set(date, element);
                  else dayButtonRefs.current.delete(date);
                }}
                aria-pressed={active}
                aria-label={`Show ${label.long}`}
                onClick={() => jumpToDay(date)}
                className={`min-w-20 shrink-0 rounded-xl px-3 py-2 text-center transition ${active ? "bg-emerald-500 text-white shadow-lg shadow-emerald-950/30" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
              >
                <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70">{label.weekday}</span>
                <span className="block text-sm font-semibold">{label.short}</span>
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => window.print()}
          aria-label={printButtonLabel}
          title={printButtonLabel}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-white px-3 font-bold text-slate-900 shadow-sm transition hover:bg-emerald-100 sm:px-4"
        >
          <span aria-hidden="true" className="text-lg">↗</span>
          <span className="hidden sm:inline">{printDay ? "Print day" : "Print week"}</span>
        </button>
      </div>

      <div className="shift-no-print flex flex-col gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 lg:flex-row lg:items-end">
        <label className="flex-1 text-xs font-semibold text-slate-300">
          Find a person
          <div className="relative mt-1">
            <span aria-hidden="true" className="absolute left-3 top-2.5 text-slate-500">⌕</span>
            <input
              aria-label="Find a person"
              value={person}
              onChange={(event) => setPerson(event.target.value)}
              placeholder="Search first or last name"
              className="block w-full rounded-xl border border-white/10 bg-slate-950/70 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
            />
          </div>
        </label>
        <label className="text-xs font-semibold text-slate-300 lg:w-56">
          Task
          <select
            aria-label="Filter by task"
            value={taskFamily ? familyLabel(taskFamily) : ""}
            onChange={(event) => {
              const option = taskOptions.find(([label]) => label === event.target.value);
              setTaskFamily(option?.[1] ?? "");
            }}
            className="mt-1 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white"
          >
            <option value="">All task areas</option>
            {taskOptions.map(([label]) => <option key={label} value={label}>{label}</option>)}
          </select>
        </label>
        <label className="flex h-10 items-center gap-2 rounded-xl bg-slate-950/50 px-3 text-sm font-semibold text-slate-300 ring-1 ring-white/10">
          <input
            type="checkbox"
            aria-label="Unassigned only"
            checked={unassignedOnly}
            onChange={(event) => setUnassignedOnly(event.target.checked)}
            className="h-4 w-4 accent-amber-400"
          />
          Unassigned only
        </label>
        <button type="button" onClick={clear} className="h-10 rounded-xl px-3 text-sm font-semibold text-emerald-400 hover:bg-white/5 hover:text-emerald-300">
          Clear filters
        </button>
      </div>

      <div className="shift-no-print flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>{visibleRows.length} of {rows.length} assignments</span>
        {activeDay && <span>{dateParts(activeDay).long}</span>}
      </div>

      {agenda.length === 0 ? (
        <div className="rounded-2xl bg-white/5 px-6 py-14 text-center ring-1 ring-white/10">
          <p className="text-base font-semibold text-white">No shifts match these filters</p>
          <button type="button" onClick={clear} className="mt-3 text-sm font-semibold text-emerald-400 hover:text-emerald-300">Show the full schedule</button>
        </div>
      ) : (
        <div className="space-y-14">
          {agenda.map((day) => (
            <section
              key={day.date}
              id={`day-${day.date}`}
              data-print-hidden={printDay && day.date !== printDay ? "true" : undefined}
              className="shift-print-day scroll-mt-28"
            >
              <div className="mb-6 flex items-center gap-4">
                <h2 className="shift-print-day-heading whitespace-nowrap text-xl font-bold text-white sm:text-2xl">{dateParts(day.date).long}</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-emerald-400/40 to-transparent" />
              </div>
              <div className="space-y-8">
                {day.slots.map((slot) => (
                  <div key={`${slot.startTime}-${slot.endTime}`} className="shift-print-slot grid gap-4 md:grid-cols-[9rem_1fr]">
                    <div className="md:pt-1">
                      <p className="shift-print-time text-base font-bold text-white">{slot.startTime}–{slot.endTime}</p>
                      <p className="shift-no-print mt-1 text-xs uppercase tracking-wider text-slate-500">{slot.cards.length} task{slot.cards.length === 1 ? "" : "s"}</p>
                    </div>
                    <div className="shift-print-cards grid gap-4 lg:grid-cols-2">
                      {slot.cards.map((card) => (
                        <TaskCard key={`${card.family}-${card.activity}`} card={card} personQuery={person} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
