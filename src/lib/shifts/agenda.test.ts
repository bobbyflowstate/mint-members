import { describe, expect, it } from "vitest";
import {
  buildShiftAgenda,
  filterRowsForAgenda,
  getScheduleMetrics,
  parseTask,
} from "./agenda";
import type { ShiftRow } from "./types";

const shift = (overrides: Partial<ShiftRow>): ShiftRow => ({
  date: "2026-08-31",
  task: "WATER // Lead",
  startTime: "9:00 am",
  endTime: "12:00 pm",
  firstName: "Bobby",
  lastName: "Lyte",
  ...overrides,
});

describe("parseTask", () => {
  it("separates task family, activity, and role", () => {
    expect(parseTask("MEAL // Brunch Crew")).toEqual({
      family: "MEAL",
      activity: "Brunch",
      role: "Crew",
    });
    expect(parseTask("WATER // Support")).toEqual({
      family: "WATER",
      activity: "Water",
      role: "Support",
    });
    expect(parseTask("LNT // Lead - Morning Kitchen")).toEqual({
      family: "LNT",
      activity: "Morning Kitchen",
      role: "Lead",
    });
  });
});

describe("buildShiftAgenda", () => {
  it("orders days and time slots chronologically rather than lexically", () => {
    const agenda = buildShiftAgenda([
      shift({ date: "2026-09-01", startTime: "1:00 pm" }),
      shift({ date: "2026-08-31", startTime: "12:00 pm" }),
      shift({ date: "2026-08-31", startTime: "9:00 am" }),
    ]);

    expect(agenda.map((day) => day.date)).toEqual(["2026-08-31", "2026-09-01"]);
    expect(agenda[0].slots.map((slot) => slot.startTime)).toEqual(["9:00 am", "12:00 pm"]);
  });

  it("groups related roles into a single task card and keeps unassigned slots", () => {
    const agenda = buildShiftAgenda([
      shift({ task: "WATER // Lead", firstName: "Bobby", lastName: "Lyte" }),
      shift({ task: "WATER // Support", firstName: "Belén", lastName: "Anadija" }),
      shift({ task: "WATER // Support", firstName: "", lastName: "" }),
    ]);

    expect(agenda[0].slots[0].cards).toEqual([
      expect.objectContaining({
        family: "WATER",
        activity: "Water",
        assignments: [
          { role: "Lead", assignee: "Bobby Lyte", unassigned: false },
          { role: "Support", assignee: "Belén Anadija", unassigned: false },
          { role: "Support", assignee: "Unassigned", unassigned: true },
        ],
      }),
    ]);
  });

  it("lists leads ahead of the rest of the team on a task card", () => {
    const agenda = buildShiftAgenda([
      shift({ task: "WATER // Support", firstName: "Zoe", lastName: "Able" }),
      shift({ task: "WATER // Support", firstName: "", lastName: "" }),
      shift({ task: "WATER // Lead", firstName: "Bobby", lastName: "Lyte" }),
    ]);

    expect(agenda[0].slots[0].cards[0].assignments).toEqual([
      { role: "Lead", assignee: "Bobby Lyte", unassigned: false },
      { role: "Support", assignee: "Zoe Able", unassigned: false },
      { role: "Support", assignee: "Unassigned", unassigned: true },
    ]);
  });

  it("orders cards by task family and activity inside a time slot", () => {
    const agenda = buildShiftAgenda([
      shift({ task: "WATER // Lead" }),
      shift({ task: "BAR // Manager" }),
      shift({ task: "MEAL // Brunch Crew" }),
    ]);
    expect(agenda[0].slots[0].cards.map((card) => card.family)).toEqual([
      "BAR",
      "MEAL",
      "WATER",
    ]);
  });
});

describe("getScheduleMetrics", () => {
  it("counts spots from the entire row set", () => {
    expect(getScheduleMetrics([
      shift({ firstName: "Bobby", lastName: "Lyte" }),
      shift({ firstName: "Belén", lastName: "Anadija" }),
      shift({ firstName: "", lastName: "" }),
      shift({ firstName: "Alex", lastName: "" }),
    ])).toEqual({
      totalSpots: 4,
      filledSpots: 3,
      unassignedSpots: 1,
      filledPercent: 75,
    });
  });
});

describe("filterRowsForAgenda", () => {
  it("keeps every assignment on a matching person's task card", () => {
    const rows = [
      shift({ task: "ICE // Support", firstName: "Alex", lastName: "Zulu" }),
      shift({ task: "ICE // Support", firstName: "Zoe", lastName: "Able" }),
      shift({ task: "ICE // Lead", firstName: "Bobby", lastName: "Lyte" }),
    ];

    expect(filterRowsForAgenda(rows, {
      person: "alex",
      taskFamily: "",
      unassignedOnly: false,
    })).toEqual(rows.slice(0, 2));
  });

  it("keeps every assignment on a card containing an unassigned spot", () => {
    const rows = [
      shift({ task: "WATER // Support", firstName: "", lastName: "" }),
      shift({ task: "WATER // Support", firstName: "Zoe", lastName: "Able" }),
      shift({ task: "WATER // Lead", firstName: "Bobby", lastName: "Lyte" }),
    ];

    expect(filterRowsForAgenda(rows, {
      person: "",
      taskFamily: "",
      unassignedOnly: true,
    })).toEqual(rows.slice(0, 2));
  });
});
