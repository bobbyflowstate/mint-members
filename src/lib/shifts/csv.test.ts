import { describe, expect, it } from "vitest";
import { parseShiftsCsvText } from "./csv";

const HEADER =
  '"Date","Task","Spot Type","Quantity","Desc","Start Time","End Time","Who","First Name","Last Name","Email","Phone"';

describe("parseShiftsCsvText", () => {
  it("extracts only public schedule fields and normalizes dates", () => {
    const csv = `${HEADER}\n"2026/08/28","WATER // Lead","to-do","1","","9:00 am","12:00 pm","Bobby Lyte","Bobby","Lyte","bobby@example.com","123"`;

    expect(parseShiftsCsvText(csv)).toEqual({
      rows: [{
        date: "2026-08-28",
        task: "WATER // Lead",
        startTime: "9:00 am",
        endTime: "12:00 pm",
        firstName: "Bobby",
        lastName: "Lyte",
      }],
      warnings: [],
      notices: [],
    });
  });

  it("keeps unassigned shifts and supports first-name-only assignments", () => {
    const csv = [
      HEADER,
      '"2026/08/30","MEAL // Crew","to-do","1","","10:00 am","12:00 pm","","","","",""',
      '"2026/08/31","LNT // Lead","to-do","1","","8:00 am","9:00 am","alvaro","alvaro","","",""',
    ].join("\n");

    const result = parseShiftsCsvText(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].firstName).toBe("");
    expect(result.rows[0].lastName).toBe("");
    expect(result.rows[1].firstName).toBe("alvaro");
    expect(result.notices).toEqual([]);
  });

  it("skips comment rows that SignUp.com exports alongside the real spots", () => {
    const csv = [
      HEADER,
      '"2026/08/28","WATER // Lead","to-do","1","","9:00 am","12:00 pm","Bobby Lyte","Bobby","Lyte","bobby@example.com","123"',
      // A comment record: same slot, nobody attached, commenter's email only.
      '"2026/08/30","MEAL // Brunch Crew","to-do","2","","10:00 am","12:00 pm","","","","jean@example.com",""',
      '"2026/08/31","LNT // Lead","to-do","1","","8:00 am","9:00 am","alvaro","alvaro","","alvaro@example.com",""',
    ].join("\n");

    const result = parseShiftsCsvText(csv);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.task)).toEqual(["WATER // Lead", "LNT // Lead"]);
    expect(result.notices).toEqual([
      "Row 3: skipped a comment from jean@example.com on MEAL // Brunch Crew" +
        " — comments are exported as rows but are not shift spots.",
    ]);
  });

  it("does not report a formatting warning for a skipped comment row", () => {
    const csv = [
      HEADER,
      '"2026/08/28","WATER // Lead","to-do","1","","9:00 am","12:00 pm","Bobby Lyte","Bobby","Lyte","bobby@example.com","123"',
      // Comment rows are truncated by the export: 11 fields instead of 12.
      '"2026/08/30","MEAL // Brunch Crew","to-do","2","","10:00 am","12:00 pm","","","","jean@example.com"',
    ].join("\n");

    const result = parseShiftsCsvText(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.notices).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it("rejects missing required headers", () => {
    expect(() => parseShiftsCsvText('"Date","Task"\n"2026/08/28","Water"'))
      .toThrow("missing required columns");
  });

  it("rejects rows with invalid required schedule values", () => {
    const csv = `${HEADER}\n"not-a-date","Water","to-do","1","","","12:00 pm","","","","",""`;
    expect(() => parseShiftsCsvText(csv)).toThrow("Row 2");
  });
});
