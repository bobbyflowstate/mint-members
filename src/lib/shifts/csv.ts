import Papa from "papaparse";
import type { ShiftRow } from "./types";

const REQUIRED_COLUMNS = [
  "Date",
  "Task",
  "Start Time",
  "End Time",
  "First Name",
  "Last Name",
] as const;

function normalizeDate(value: string): string | null {
  const match = value.trim().match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  const normalized = `${year}-${month}-${day}`;
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== normalized
    ? null
    : normalized;
}

export interface ShiftCsvResult {
  rows: ShiftRow[];
  warnings: string[];
  notices: string[];
}

/**
 * SignUp.com exports each comment left on a slot as its own row: same date, task
 * and times as the slot, but nobody attached and the commenter's email in place
 * of a name. Those rows are not spots, so counting them inflates the schedule
 * total and shows phantom open shifts. A genuinely unassigned spot has no name
 * *and* no comment or email, so it is kept.
 */
function isCommentOnlyRow(raw: Record<string, string>): boolean {
  const hasAssignee = Boolean(
    (raw["First Name"] ?? "").trim() ||
      (raw["Last Name"] ?? "").trim() ||
      (raw.Who ?? "").trim()
  );
  if (hasAssignee) return false;
  return Boolean((raw.Comment ?? "").trim() || (raw.Email ?? "").trim());
}

export function parseShiftsCsvText(csvText: string): ShiftCsvResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const fields = parsed.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((column) => !fields.includes(column));
  if (missing.length > 0) {
    throw new Error(`CSV is missing required columns: ${missing.join(", ")}`);
  }

  const fatal = parsed.errors.find(
    (error) => error.code !== "TooFewFields" && error.code !== "TooManyFields"
  );
  if (fatal) throw new Error(`CSV parsing failed: ${fatal.message}`);

  const notices: string[] = [];
  const skipped = new Set<number>();
  const rows: ShiftRow[] = [];

  parsed.data.forEach((raw, index) => {
    if (isCommentOnlyRow(raw)) {
      skipped.add(index);
      const author = (raw.Email ?? "").trim();
      const task = (raw.Task ?? "").trim();
      notices.push(
        `Row ${index + 2}: skipped a comment${author ? ` from ${author}` : ""}` +
          `${task ? ` on ${task}` : ""} — comments are exported as rows but are not shift spots.`
      );
      return;
    }

    const date = normalizeDate(raw.Date ?? "");
    const task = (raw.Task ?? "").trim();
    const startTime = (raw["Start Time"] ?? "").trim();
    const endTime = (raw["End Time"] ?? "").trim();
    if (!date || !task || !startTime || !endTime) {
      throw new Error(
        `Row ${index + 2} has an invalid date or is missing task/start/end time`
      );
    }
    rows.push({
      date,
      task,
      startTime,
      endTime,
      firstName: (raw["First Name"] ?? "").trim(),
      lastName: (raw["Last Name"] ?? "").trim(),
    });
  });

  // Comment rows are truncated by the export (they stop before the trailing
  // columns), so their field-count complaints would be noise next to the notice.
  const warnings = parsed.errors
    .filter((error) => error.code === "TooFewFields" || error.code === "TooManyFields")
    .filter((error) => !skipped.has(error.row ?? -1))
    .map((error) => `Row ${(error.row ?? 0) + 2}: ${error.message}`);

  return { rows, warnings, notices };
}

export async function parseShiftsCsv(file: File): Promise<ShiftCsvResult> {
  return parseShiftsCsvText(await file.text());
}
