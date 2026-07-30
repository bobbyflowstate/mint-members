import { describe, expect, it } from "vitest";
import { applyShiftView } from "./view";
import type { ShiftRow } from "./types";

const rows: ShiftRow[] = [
  { date: "2026-08-29", task: "Water", startTime: "9:00 am", endTime: "12:00 pm", firstName: "Zoe", lastName: "Able" },
  { date: "2026-08-28", task: "Meals", startTime: "10:00 am", endTime: "12:00 pm", firstName: "Alex", lastName: "Zulu" },
  { date: "2026-08-28", task: "Water", startTime: "1:00 pm", endTime: "2:00 pm", firstName: "", lastName: "" },
];

describe("applyShiftView", () => {
  it("combines name, day, and task filters", () => {
    expect(applyShiftView(rows, {
      firstName: "zo",
      lastName: "",
      date: "2026-08-29",
      task: "Water",
      sortField: "date",
      sortDirection: "asc",
    })).toEqual([rows[0]]);
  });

  it("can filter unassigned shifts", () => {
    expect(applyShiftView(rows, {
      firstName: "unassigned",
      lastName: "",
      date: "",
      task: "",
      sortField: "date",
      sortDirection: "asc",
    })).toEqual([rows[2]]);
  });

  it("sorts by the requested public field without mutating input", () => {
    const result = applyShiftView(rows, {
      firstName: "",
      lastName: "",
      date: "",
      task: "",
      sortField: "firstName",
      sortDirection: "asc",
    });
    expect(result.map((row) => row.firstName || "Unassigned")).toEqual(["Alex", "Unassigned", "Zoe"]);
    expect(rows[0].firstName).toBe("Zoe");
  });
});
