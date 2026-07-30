import type { ShiftRow } from "./types";

const FAMILY_LABELS: Record<string, string> = {
  BAR: "Bar",
  "BIKE PARK": "Bike Park",
  ICE: "Ice",
  LNT: "LNT",
  MEAL: "Meals",
  MEALS: "Meals",
  SOUND: "Sound",
  WATER: "Water",
};

export interface ParsedTask {
  family: string;
  activity: string;
  role: string;
}

export interface AgendaAssignment {
  role: string;
  assignee: string;
  unassigned: boolean;
}

export interface AgendaCard {
  family: string;
  familyLabel: string;
  activity: string;
  assignments: AgendaAssignment[];
}

export interface AgendaSlot {
  startTime: string;
  endTime: string;
  cards: AgendaCard[];
}

export interface AgendaDay {
  date: string;
  slots: AgendaSlot[];
}

export interface ScheduleMetrics {
  totalSpots: number;
  filledSpots: number;
  unassignedSpots: number;
  filledPercent: number;
}

export function familyLabel(family: string): string {
  return FAMILY_LABELS[family] ??
    family.toLocaleLowerCase().replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

export function parseTask(task: string): ParsedTask {
  const [rawFamily, ...restParts] = task.split("//");
  const family = rawFamily.trim().toLocaleUpperCase();
  const detail = restParts.join("//").trim();
  if (!detail) {
    return { family, activity: familyLabel(family), role: "Assigned" };
  }

  const leadingRole = detail.match(/^(Lead|Support|Crew|Manager|Supervisor)\s*-\s*(.+)$/i);
  if (leadingRole) {
    return {
      family,
      activity: leadingRole[2].trim(),
      role: leadingRole[1],
    };
  }

  const phase = detail.match(/\s*(\([^)]*\))\s*$/)?.[1] ?? "";
  const withoutPhase = phase ? detail.slice(0, -phase.length).trim() : detail;
  const trailingRole = withoutPhase.match(/^(.*?)(?:\s+)(Lead|Support|Crew|Manager|Supervisor|Cutter)$/i);
  if (trailingRole) {
    const activityBase = trailingRole[1].trim();
    return {
      family,
      activity: `${activityBase || familyLabel(family)}${phase ? ` ${phase}` : ""}`,
      role: trailingRole[2],
    };
  }

  if (/^(Lead|Support|Crew|Manager|Supervisor|Cutter)$/i.test(withoutPhase)) {
    return {
      family,
      activity: familyLabel(family),
      role: withoutPhase,
    };
  }
  return { family, activity: detail, role: "Assigned" };
}

export function getScheduleMetrics(rows: ShiftRow[]): ScheduleMetrics {
  const filledSpots = rows.filter((row) => row.firstName || row.lastName).length;
  const totalSpots = rows.length;
  return {
    totalSpots,
    filledSpots,
    unassignedSpots: totalSpots - filledSpots,
    filledPercent: totalSpots === 0 ? 0 : Math.round((filledSpots / totalSpots) * 100),
  };
}

function assignmentGroupKey(row: ShiftRow): string {
  return [row.date, row.startTime, row.endTime, row.task].join("\u0000");
}

export function filterRowsForAgenda(
  rows: ShiftRow[],
  filters: { person: string; taskFamily: string; unassignedOnly: boolean }
): ShiftRow[] {
  const query = filters.person.trim().toLocaleLowerCase();
  const eligibleRows = filters.taskFamily
    ? rows.filter((row) => parseTask(row.task).family === filters.taskFamily)
    : rows;
  const matchingGroups = new Set<string>();

  for (const row of eligibleRows) {
    const name = `${row.firstName} ${row.lastName}`.trim().toLocaleLowerCase();
    if (
      (!query || name.includes(query)) &&
      (!filters.unassignedOnly || !name)
    ) {
      matchingGroups.add(assignmentGroupKey(row));
    }
  }

  return eligibleRows.filter((row) => matchingGroups.has(assignmentGroupKey(row)));
}

function timeValue(time: string): number {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hour = Number(match[1]) % 12;
  if (match[3].toLocaleLowerCase() === "pm") hour += 12;
  return hour * 60 + Number(match[2]);
}

export function buildShiftAgenda(rows: ShiftRow[]): AgendaDay[] {
  const days = new Map<string, Map<string, Map<string, AgendaCard>>>();

  for (const row of rows) {
    const day = days.get(row.date) ?? new Map<string, Map<string, AgendaCard>>();
    days.set(row.date, day);
    const slotKey = `${row.startTime}\u0000${row.endTime}`;
    const slot = day.get(slotKey) ?? new Map<string, AgendaCard>();
    day.set(slotKey, slot);

    const task = parseTask(row.task);
    const cardKey = `${task.family}\u0000${task.activity}`;
    const card = slot.get(cardKey) ?? {
      family: task.family,
      familyLabel: familyLabel(task.family),
      activity: task.activity,
      assignments: [],
    };
    slot.set(cardKey, card);
    const assignee = `${row.firstName} ${row.lastName}`.trim();
    card.assignments.push({
      role: task.role,
      assignee: assignee || "Unassigned",
      unassigned: !assignee,
    });
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, slots]) => ({
      date,
      slots: [...slots.entries()]
        .map(([key, cards]) => {
          const [startTime, endTime] = key.split("\u0000");
          return {
            startTime,
            endTime,
            cards: [...cards.values()].sort(
              (a, b) =>
                a.familyLabel.localeCompare(b.familyLabel) ||
                a.activity.localeCompare(b.activity)
            ),
          };
        })
        .sort(
          (a, b) =>
            timeValue(a.startTime) - timeValue(b.startTime) ||
            a.endTime.localeCompare(b.endTime)
        ),
    }));
}
