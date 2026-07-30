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

  const warnings = parsed.errors
    .filter((error) => error.code === "TooFewFields" || error.code === "TooManyFields")
    .map((error) => `Row ${(error.row ?? 0) + 2}: ${error.message}`);
  const fatal = parsed.errors.find(
    (error) => error.code !== "TooFewFields" && error.code !== "TooManyFields"
  );
  if (fatal) throw new Error(`CSV parsing failed: ${fatal.message}`);

  const rows = parsed.data.map((raw, index): ShiftRow => {
    const date = normalizeDate(raw.Date ?? "");
    const task = (raw.Task ?? "").trim();
    const startTime = (raw["Start Time"] ?? "").trim();
    const endTime = (raw["End Time"] ?? "").trim();
    if (!date || !task || !startTime || !endTime) {
      throw new Error(
        `Row ${index + 2} has an invalid date or is missing task/start/end time`
      );
    }
    return {
      date,
      task,
      startTime,
      endTime,
      firstName: (raw["First Name"] ?? "").trim(),
      lastName: (raw["Last Name"] ?? "").trim(),
    };
  });

  return { rows, warnings };
}

export async function parseShiftsCsv(file: File): Promise<ShiftCsvResult> {
  return parseShiftsCsvText(await file.text());
}
