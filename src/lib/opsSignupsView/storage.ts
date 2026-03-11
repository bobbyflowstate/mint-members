import {
  DEFAULT_SIGNUPS_VIEW_STATE,
  FILTER_OPERATORS,
  isSignupColumnId,
  SignupColumnId,
  SortDirection,
} from "./types";

export const EXPORT_SIGNUPS_VIEW_STORAGE_KEY = "ops_signups_export_view_v1";

const ALLOWED_SEARCH_FIELDS = ["fullName", "email", "phone"] as const;
type SearchField = (typeof ALLOWED_SEARCH_FIELDS)[number];
type BooleanQuickFilter = "any" | "yes" | "no";
type RequestsQuickFilter = "any" | "has_requests";
const ALLOWED_STATUS_FILTERS = [
  "all",
  "confirmed",
  "pending_payment",
  "needs_ops_review",
  "rejected",
] as const;

export interface ExportViewUiState {
  visibleColumns: SignupColumnId[];
  arrivalOperator: (typeof FILTER_OPERATORS)[number];
  arrivalDate: string;
  departureOperator: (typeof FILTER_OPERATORS)[number];
  departureDate: string;
  statusFilter: string;
  searchField: SearchField;
  searchValue: string;
  sortField: SignupColumnId;
  sortDirection: SortDirection;
  hasBurningManTicketFilter: BooleanQuickFilter;
  hasVehiclePassFilter: BooleanQuickFilter;
  requestsFilter: RequestsQuickFilter;
}

const DEFAULT_EXPORT_VIEW_UI_STATE: ExportViewUiState = {
  visibleColumns: DEFAULT_SIGNUPS_VIEW_STATE.visibleColumns,
  arrivalOperator: "on_or_before",
  arrivalDate: "",
  departureOperator: "on_or_before",
  departureDate: "",
  statusFilter: "all",
  searchField: "fullName",
  searchValue: "",
  sortField: DEFAULT_SIGNUPS_VIEW_STATE.sort.field,
  sortDirection: DEFAULT_SIGNUPS_VIEW_STATE.sort.direction,
  hasBurningManTicketFilter: "any",
  hasVehiclePassFilter: "any",
  requestsFilter: "any",
};

function isBooleanQuickFilter(value: unknown): value is BooleanQuickFilter {
  return value === "any" || value === "yes" || value === "no";
}

function isRequestsQuickFilter(value: unknown): value is RequestsQuickFilter {
  return value === "any" || value === "has_requests";
}

function isFilterOperatorValue(value: unknown): value is (typeof FILTER_OPERATORS)[number] {
  return (
    typeof value === "string" &&
    (FILTER_OPERATORS as readonly string[]).includes(value)
  );
}

function isSearchField(value: unknown): value is SearchField {
  return typeof value === "string" && (ALLOWED_SEARCH_FIELDS as readonly string[]).includes(value);
}

function isStatusFilter(value: unknown): value is ExportViewUiState["statusFilter"] {
  return (
    typeof value === "string" &&
    (ALLOWED_STATUS_FILTERS as readonly string[]).includes(value)
  );
}

function normalizeState(raw: unknown): ExportViewUiState {
  const maybe = raw as Partial<Record<keyof ExportViewUiState, unknown>>;

  const visibleColumns = Array.isArray(maybe.visibleColumns)
    ? maybe.visibleColumns
        .filter((column): column is string => typeof column === "string")
        .filter(isSignupColumnId)
    : [];

  return {
    visibleColumns:
      visibleColumns.length > 0
        ? Array.from(new Set(visibleColumns))
        : DEFAULT_EXPORT_VIEW_UI_STATE.visibleColumns,
    arrivalOperator: isFilterOperatorValue(maybe.arrivalOperator)
      ? maybe.arrivalOperator
      : DEFAULT_EXPORT_VIEW_UI_STATE.arrivalOperator,
    arrivalDate: typeof maybe.arrivalDate === "string" ? maybe.arrivalDate : "",
    departureOperator: isFilterOperatorValue(maybe.departureOperator)
      ? maybe.departureOperator
      : DEFAULT_EXPORT_VIEW_UI_STATE.departureOperator,
    departureDate: typeof maybe.departureDate === "string" ? maybe.departureDate : "",
    statusFilter: isStatusFilter(maybe.statusFilter)
      ? maybe.statusFilter
      : DEFAULT_EXPORT_VIEW_UI_STATE.statusFilter,
    searchField: isSearchField(maybe.searchField)
      ? maybe.searchField
      : DEFAULT_EXPORT_VIEW_UI_STATE.searchField,
    searchValue:
      typeof maybe.searchValue === "string" ? maybe.searchValue : DEFAULT_EXPORT_VIEW_UI_STATE.searchValue,
    sortField:
      typeof maybe.sortField === "string" && isSignupColumnId(maybe.sortField)
        ? maybe.sortField
        : DEFAULT_EXPORT_VIEW_UI_STATE.sortField,
    sortDirection:
      maybe.sortDirection === "asc" || maybe.sortDirection === "desc"
        ? maybe.sortDirection
        : DEFAULT_EXPORT_VIEW_UI_STATE.sortDirection,
    hasBurningManTicketFilter: isBooleanQuickFilter(maybe.hasBurningManTicketFilter)
      ? maybe.hasBurningManTicketFilter
      : DEFAULT_EXPORT_VIEW_UI_STATE.hasBurningManTicketFilter,
    hasVehiclePassFilter: isBooleanQuickFilter(maybe.hasVehiclePassFilter)
      ? maybe.hasVehiclePassFilter
      : DEFAULT_EXPORT_VIEW_UI_STATE.hasVehiclePassFilter,
    requestsFilter: isRequestsQuickFilter(maybe.requestsFilter)
      ? maybe.requestsFilter
      : DEFAULT_EXPORT_VIEW_UI_STATE.requestsFilter,
  };
}

export function loadStoredExportViewState(): ExportViewUiState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(EXPORT_SIGNUPS_VIEW_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return null;
  }
}

export function saveExportViewState(state: ExportViewUiState): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(EXPORT_SIGNUPS_VIEW_STORAGE_KEY, JSON.stringify(state));
}

export function clearStoredExportViewState(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(EXPORT_SIGNUPS_VIEW_STORAGE_KEY);
}
