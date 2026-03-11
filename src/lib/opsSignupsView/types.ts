export const SIGNUP_COLUMN_IDS = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "arrival",
  "arrivalTime",
  "departure",
  "departureTime",
  "status",
  "createdAt",
  "hasBurningManTicket",
  "hasVehiclePass",
  "requests",
] as const;

export type SignupColumnId = (typeof SIGNUP_COLUMN_IDS)[number];

export const FILTER_OPERATORS = [
  "eq",
  "contains",
  "before",
  "after",
  "on_or_before",
  "on_or_after",
  "in",
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export type SortDirection = "asc" | "desc";

export interface SignupFilter {
  field: SignupColumnId;
  operator: FilterOperator;
  value?: string;
  values?: string[];
}

export interface SignupSort {
  field: SignupColumnId;
  direction: SortDirection;
}

export interface SignupViewState {
  visibleColumns: SignupColumnId[];
  filters: SignupFilter[];
  sort: SignupSort;
  limit: number;
}

export const DEFAULT_SIGNUPS_VIEW_STATE: SignupViewState = {
  visibleColumns: [
    "firstName",
    "lastName",
    "email",
    "phone",
    "status",
    "arrival",
    "departure",
  ],
  filters: [],
  sort: {
    field: "createdAt",
    direction: "desc",
  },
  limit: 5000,
};

export function isSignupColumnId(value: string): value is SignupColumnId {
  return (SIGNUP_COLUMN_IDS as readonly string[]).includes(value);
}

export function isFilterOperator(value: string): value is FilterOperator {
  return (FILTER_OPERATORS as readonly string[]).includes(value);
}

function normalizeVisibleColumns(input: unknown): SignupColumnId[] {
  if (!Array.isArray(input)) {
    return DEFAULT_SIGNUPS_VIEW_STATE.visibleColumns;
  }

  const filtered = input
    .filter((value): value is string => typeof value === "string")
    .filter(isSignupColumnId);
  const unique = Array.from(new Set(filtered));

  return unique.length > 0 ? unique : DEFAULT_SIGNUPS_VIEW_STATE.visibleColumns;
}

function normalizeSort(input: unknown): SignupSort {
  if (!input || typeof input !== "object") {
    return DEFAULT_SIGNUPS_VIEW_STATE.sort;
  }

  const maybeSort = input as { field?: unknown; direction?: unknown };
  const field =
    typeof maybeSort.field === "string" && isSignupColumnId(maybeSort.field)
      ? maybeSort.field
      : DEFAULT_SIGNUPS_VIEW_STATE.sort.field;
  const direction =
    maybeSort.direction === "asc" || maybeSort.direction === "desc"
      ? maybeSort.direction
      : DEFAULT_SIGNUPS_VIEW_STATE.sort.direction;

  if (!field || !direction) {
    return DEFAULT_SIGNUPS_VIEW_STATE.sort;
  }

  return { field, direction };
}

function normalizeFilters(input: unknown): SignupFilter[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.reduce<SignupFilter[]>((normalizedFilters, rawFilter) => {
    if (!rawFilter || typeof rawFilter !== "object") {
      return normalizedFilters;
    }

    const filter = rawFilter as {
      field?: unknown;
      operator?: unknown;
      value?: unknown;
      values?: unknown;
    };

    if (typeof filter.field !== "string" || !isSignupColumnId(filter.field)) {
      return normalizedFilters;
    }
    if (typeof filter.operator !== "string" || !isFilterOperator(filter.operator)) {
      return normalizedFilters;
    }

    if (filter.operator === "in") {
      if (!Array.isArray(filter.values)) {
        return normalizedFilters;
      }
      const values = filter.values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      if (values.length === 0) {
        return normalizedFilters;
      }
      normalizedFilters.push({ field: filter.field, operator: filter.operator, values });
      return normalizedFilters;
    }

    if (typeof filter.value !== "string") {
      return normalizedFilters;
    }
    const value = filter.value.trim();
    if (value.length === 0) {
      return normalizedFilters;
    }

    normalizedFilters.push({ field: filter.field, operator: filter.operator, value });
    return normalizedFilters;
  }, []);
}

function normalizeLimit(input: unknown): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return DEFAULT_SIGNUPS_VIEW_STATE.limit;
  }

  const floored = Math.floor(input);
  if (floored < 1) {
    return DEFAULT_SIGNUPS_VIEW_STATE.limit;
  }

  return Math.min(floored, 5000);
}

export function normalizeSignupViewState(input: unknown): SignupViewState {
  const maybe = (input ?? {}) as {
    visibleColumns?: unknown;
    filters?: unknown;
    sort?: unknown;
    limit?: unknown;
  };

  return {
    visibleColumns: normalizeVisibleColumns(maybe.visibleColumns),
    filters: normalizeFilters(maybe.filters),
    sort: normalizeSort(maybe.sort),
    limit: normalizeLimit(maybe.limit),
  };
}
