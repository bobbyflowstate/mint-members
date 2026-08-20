import { SortDirection } from "./types";

/** A comparable key derived from a row for ordering purposes. */
export type SortKey = string | number;

/**
 * Arrival and departure times are stored as one of three fixed slot labels
 * (see the `arrivalDepartureTime` union in convex/schema.ts). Their text does
 * not order chronologically — "6.01 pm" leads "11.01 am" under both lexical
 * and numeric collation — so each label maps to its slot index instead.
 *
 * Keys must match the schema literals exactly; an unmatched label degrades to
 * UNKNOWN_TIME_SLOT rather than throwing, so a schema change shows up as
 * same-date rows clumping together rather than as a crash.
 */
export const TIME_SLOT_ORDER: Record<string, number> = {
  "12:01 am to 11.00 am": 0,
  "11.01 am to 6.00 pm": 1,
  "6.01 pm to 12.00 am": 2,
};

/** Unrecognized or blank times sort after the three known slots on the same date. */
export const UNKNOWN_TIME_SLOT = 3;

/** Fields whose sort key is a date paired with a companion time-slot field. */
export const DATE_TIME_COMPANION_FIELDS: Record<string, string> = {
  arrival: "arrivalTime",
  departure: "departureTime",
};

/**
 * Build a chronologically ordered key from a date and its time slot.
 * A missing date yields a blank key so the row sinks — see compareSortValues.
 */
export function dateTimeSortValue(
  date: string | undefined,
  time: string | undefined
): SortKey {
  if (!date) return "";
  return `${date}T${TIME_SLOT_ORDER[time ?? ""] ?? UNKNOWN_TIME_SLOT}`;
}

/** Whether the payment badge applies to this row at all. */
export function isPaymentEligible(row: {
  _source?: string;
  status?: string;
}): boolean {
  return (
    row._source === "invite" ||
    row.status === "confirmed" ||
    row.status === "pending_payment" ||
    row.status === "payment_processing"
  );
}

/** Keys with no value to order by. These always sort last. */
export function isBlankSortKey(value: SortKey | null | undefined): boolean {
  return value === "" || value === null || value === undefined;
}

/**
 * Order two sort keys. Blanks sink to the bottom whichever direction is active,
 * so reversing the sort never surfaces a block of empty rows. Numbers compare
 * numerically; everything else uses case-insensitive natural-order collation.
 */
export function compareSortValues(
  a: SortKey,
  b: SortKey,
  direction: SortDirection
): number {
  const aBlank = isBlankSortKey(a);
  const bBlank = isBlankSortKey(b);
  if (aBlank && bBlank) return 0;
  if (aBlank) return 1;
  if (bBlank) return -1;

  const sign = direction === "asc" ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * sign;
  return (
    String(a).localeCompare(String(b), undefined, {
      sensitivity: "base",
      numeric: true,
    }) * sign
  );
}

/**
 * The slice of a column definition that sorting needs. Kept structural so this
 * module stays free of React types.
 */
export interface SortableColumn<Row> {
  sortValue?: (row: Row) => SortKey;
  renderText: (row: Row) => string;
}

/** A column's sort key, falling back to its rendered text. */
export function getSortValue<Row>(
  column: SortableColumn<Row>,
  row: Row
): SortKey {
  return column.sortValue ? column.sortValue(row) : column.renderText(row);
}

/** Order rows by a column, without mutating the input. */
export function sortRows<Row>(
  rows: readonly Row[],
  column: SortableColumn<Row>,
  direction: SortDirection
): Row[] {
  return [...rows].sort((a, b) =>
    compareSortValues(getSortValue(column, a), getSortValue(column, b), direction)
  );
}
