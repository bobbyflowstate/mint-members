import { SignupFilter, SignupSort } from "./types";
import {
  DATE_TIME_COMPANION_FIELDS,
  SortKey,
  compareSortValues,
  dateTimeSortValue,
} from "./sort";

type RowValue = string | number | boolean | undefined | null;

function getValue(row: Record<string, unknown>, field: string): RowValue {
  return row[field] as RowValue;
}

function asString(value: RowValue): string {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function compareAsString(left: RowValue, right: string): number {
  return asString(left).localeCompare(right);
}

function matchesFilter(row: Record<string, unknown>, filter: SignupFilter): boolean {
  const rowValue = getValue(row, filter.field);

  switch (filter.operator) {
    case "eq": {
      if (filter.value === undefined) {
        return false;
      }
      return asString(rowValue).toLowerCase() === filter.value.toLowerCase();
    }
    case "contains": {
      if (filter.value === undefined) {
        return false;
      }
      return asString(rowValue).toLowerCase().includes(filter.value.toLowerCase());
    }
    case "before": {
      if (filter.value === undefined) {
        return false;
      }
      return compareAsString(rowValue, filter.value) < 0;
    }
    case "after": {
      if (filter.value === undefined) {
        return false;
      }
      return compareAsString(rowValue, filter.value) > 0;
    }
    case "on_or_before": {
      if (filter.value === undefined) {
        return false;
      }
      return compareAsString(rowValue, filter.value) <= 0;
    }
    case "on_or_after": {
      if (filter.value === undefined) {
        return false;
      }
      return compareAsString(rowValue, filter.value) >= 0;
    }
    case "in": {
      if (!filter.values || filter.values.length === 0) {
        return false;
      }
      const candidate = asString(rowValue).toLowerCase();
      return filter.values.some((value) => value.toLowerCase() === candidate);
    }
    case "not_empty": {
      return asString(rowValue).trim().length > 0;
    }
    default:
      return false;
  }
}

export function matchesSignupFilters(
  row: Record<string, unknown>,
  filters: SignupFilter[]
): boolean {
  return filters.every((filter) => matchesFilter(row, filter));
}

/**
 * Derive the comparable key for a field. Date fields pair with their time-slot
 * companion so the two rows order chronologically rather than by label text.
 */
function sortKeyFor(row: Record<string, unknown>, field: string): SortKey {
  const companionField = DATE_TIME_COMPANION_FIELDS[field];
  if (companionField) {
    return dateTimeSortValue(
      asString(getValue(row, field)),
      asString(getValue(row, companionField))
    );
  }

  const value = getValue(row, field);
  return typeof value === "number" ? value : asString(value);
}

/**
 * Order two signup rows. Shares its comparison semantics with the ops members
 * table via ./sort, so the server's default ordering and an interactive column
 * sort agree on what "ascending" means for a given field.
 */
export function compareSignups(
  sort: SignupSort,
  left: Record<string, unknown>,
  right: Record<string, unknown>
): number {
  return compareSortValues(
    sortKeyFor(left, sort.field),
    sortKeyFor(right, sort.field),
    sort.direction
  );
}
