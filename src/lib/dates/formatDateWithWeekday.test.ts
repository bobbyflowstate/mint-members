import { describe, expect, it } from "vitest";
import { formatDateWithWeekday } from "./formatDateWithWeekday";

describe("formatDateWithWeekday", () => {
  it("formats YYYY-MM-DD with weekday", () => {
    const formatted = formatDateWithWeekday("2026-08-31");
    expect(formatted).toContain("Mon");
    expect(formatted).toContain("Aug");
    expect(formatted).toContain("31");
  });

  it("returns fallback when value is missing", () => {
    expect(formatDateWithWeekday(undefined)).toBe("Not specified");
  });

  it("returns raw value when date format is invalid", () => {
    expect(formatDateWithWeekday("bad-date")).toBe("bad-date");
  });
});
