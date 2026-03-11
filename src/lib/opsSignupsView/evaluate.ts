import { SignupFilter, SignupSort } from "./types";

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

export function compareSignups(
  sort: SignupSort,
  left: Record<string, unknown>,
  right: Record<string, unknown>
): number {
  const leftValue = getValue(left, sort.field);
  const rightValue = getValue(right, sort.field);

  let comparison = 0;
  if (typeof leftValue === "number" && typeof rightValue === "number") {
    comparison = leftValue - rightValue;
  } else {
    comparison = asString(leftValue).localeCompare(asString(rightValue));
  }

  return sort.direction === "asc" ? comparison : comparison * -1;
}
