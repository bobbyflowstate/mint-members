import { describe, expect, it, vi } from "vitest";
import {
  assertPublishableSchedule,
  replacePublishedSchedule,
  requireAuthenticatedMember,
  toPublicPublishedSchedule,
} from "./shifts";
import type { ShiftRow } from "../src/lib/shifts/types";

const row: ShiftRow = {
  date: "2026-08-28",
  task: "Water",
  startTime: "9:00 am",
  endTime: "12:00 pm",
  firstName: "",
  lastName: "",
};

describe("published shifts", () => {
  it("rejects unauthenticated member reads", () => {
    expect(() => requireAuthenticatedMember(null)).toThrow("Unauthenticated");
    expect(() => requireAuthenticatedMember("user_1")).not.toThrow();
  });

  it("does not expose publisher identity to members", () => {
    expect(toPublicPublishedSchedule({
      rows: [row],
      publishedAt: 123,
      publishedBy: "private@example.com",
    })).toEqual({ rows: [row], publishedAt: 123 });
  });

  it("replaces every previous published schedule with one document", async () => {
    const deleteRecord = vi.fn();
    const insert = vi.fn().mockResolvedValue("schedule_2");
    const collect = vi.fn().mockResolvedValue([{ _id: "schedule_1" }, { _id: "legacy" }]);
    const ctx = {
      db: {
        query: vi.fn().mockReturnValue({ collect }),
        delete: deleteRecord,
        insert,
      },
    };

    const result = await replacePublishedSchedule(ctx, [row], "ops@example.com", 123);

    expect(deleteRecord).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledWith("published_shift_schedules", {
      rows: [row],
      publishedAt: 123,
      publishedBy: "ops@example.com",
    });
    expect(result).toEqual({ id: "schedule_2", rowCount: 1, publishedAt: 123 });
  });

  it("refuses to publish an empty schedule", async () => {
    await expect(replacePublishedSchedule({ db: {} } as never, [], "ops", 123))
      .rejects.toThrow("at least one shift");
  });

  it("rejects malformed rows even when the client parser is bypassed", () => {
    expect(() => assertPublishableSchedule([
      { ...row, date: "08/28/2026" },
    ])).toThrow("Row 1 has an invalid date");
    expect(() => assertPublishableSchedule([
      { ...row, task: " " },
    ])).toThrow("Row 1 is missing a task");
    expect(() => assertPublishableSchedule([
      { ...row, startTime: "morning" },
    ])).toThrow("Row 1 has an invalid start time");
  });

  it("rejects schedules too large for one stored document", () => {
    const oversizedRows = Array.from(
      { length: 2_000 },
      () => ({ ...row, task: "x".repeat(450) })
    );
    expect(() => assertPublishableSchedule(oversizedRows)).toThrow("too large");
  });
});
