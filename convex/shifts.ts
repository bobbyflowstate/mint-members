import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUserEmail, requireOpsPassword } from "./lib/auth";

const shiftRowValidator = v.object({
  date: v.string(),
  task: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  firstName: v.string(),
  lastName: v.string(),
});

type PublicShiftRow = {
  date: string;
  task: string;
  startTime: string;
  endTime: string;
  firstName: string;
  lastName: string;
};

const MAX_SCHEDULE_BYTES = 900_000;
const MAX_FIELD_LENGTH = 500;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:1[0-2]|[1-9]):[0-5]\d\s*(?:am|pm)$/i;

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function assertPublishableSchedule(rows: PublicShiftRow[]): void {
  if (rows.length === 0) throw new Error("Publish requires at least one shift");

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    if (!isValidDate(row.date)) {
      throw new Error(`Row ${rowNumber} has an invalid date`);
    }
    if (!row.task.trim()) {
      throw new Error(`Row ${rowNumber} is missing a task`);
    }
    if (!TIME_PATTERN.test(row.startTime.trim())) {
      throw new Error(`Row ${rowNumber} has an invalid start time`);
    }
    if (!TIME_PATTERN.test(row.endTime.trim())) {
      throw new Error(`Row ${rowNumber} has an invalid end time`);
    }
    for (const [field, value] of Object.entries(row)) {
      if (value.length > MAX_FIELD_LENGTH) {
        throw new Error(`Row ${rowNumber} ${field} is too long`);
      }
    }
  });

  const bytes = new TextEncoder().encode(JSON.stringify(rows)).byteLength;
  if (bytes > MAX_SCHEDULE_BYTES) {
    throw new Error(
      "Schedule is too large to publish. Please reduce the CSV to fewer than 900 KB."
    );
  }
}

export function requireAuthenticatedMember(userId: string | null): void {
  if (!userId) throw new Error("Unauthenticated: Sign in to view shifts");
}

export function toPublicPublishedSchedule(schedule: {
  rows: PublicShiftRow[];
  publishedAt: number;
  publishedBy: string;
}) {
  return { rows: schedule.rows, publishedAt: schedule.publishedAt };
}

type ReplacementContext = {
  db: {
    query: (table: "published_shift_schedules") => {
      collect: () => Promise<Array<{ _id: unknown }>>;
    };
    delete: (id: unknown) => Promise<unknown> | unknown;
    insert: (
      table: "published_shift_schedules",
      value: {
        rows: PublicShiftRow[];
        publishedAt: number;
        publishedBy: string;
      }
    ) => Promise<unknown>;
  };
};

export async function replacePublishedSchedule(
  ctx: ReplacementContext,
  rows: PublicShiftRow[],
  publishedBy: string,
  publishedAt = Date.now()
) {
  assertPublishableSchedule(rows);
  const previous = await ctx.db.query("published_shift_schedules").collect();
  for (const schedule of previous) await ctx.db.delete(schedule._id);
  const id = await ctx.db.insert("published_shift_schedules", {
    rows,
    publishedAt,
    publishedBy,
  });
  return { id, rowCount: rows.length, publishedAt };
}

export const getPublished = query({
  args: {},
  handler: async (ctx) => {
    requireAuthenticatedMember(await getAuthUserId(ctx));
    const schedule = await ctx.db.query("published_shift_schedules").first();
    return schedule ? toPublicPublishedSchedule(schedule) : null;
  },
});

export const publish = mutation({
  args: {
    opsPassword: v.string(),
    rows: v.array(shiftRowValidator),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);
    return await replacePublishedSchedule(
      ctx as unknown as ReplacementContext,
      args.rows,
      await getCurrentUserEmail(ctx)
    );
  },
});
