"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import clsx from "clsx";
import { api } from "../../../convex/_generated/api";
import {
  DEFAULT_SIGNUPS_VIEW_STATE,
  FilterOperator,
  SignupColumnId,
  SignupFilter,
  SortDirection,
  normalizeSignupViewState,
} from "../../lib/opsSignupsView/types";
import { buildSignupCsv, downloadCsv } from "../../lib/opsSignupsView/csv";
import {
  loadStoredExportViewState,
  saveExportViewState,
} from "../../lib/opsSignupsView/storage";

const OPS_PASSWORD_KEY = "ops_password";

interface OpsSignupRow {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  arrival: string;
  arrivalTime: string;
  departure: string;
  departureTime: string;
  status: string;
  applicationCreatedAt: number;
  createdAt?: number;
  hasBurningManTicket: boolean;
  hasVehiclePass: boolean;
  requests: string;
}

interface SignupsViewResult {
  rows: OpsSignupRow[];
  totalBeforeFilter: number;
  totalAfterFilter: number;
  truncated: boolean;
}

interface DateBounds {
  min?: string;
  max?: string;
}

interface ColumnDefinition {
  id: SignupColumnId;
  label: string;
  render: (row: OpsSignupRow) => string;
}

const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  {
    id: "firstName",
    label: "First Name",
    render: (row) => row.firstName,
  },
  {
    id: "lastName",
    label: "Last Name",
    render: (row) => row.lastName,
  },
  {
    id: "fullName",
    label: "Full Name",
    render: (row) => row.fullName,
  },
  {
    id: "email",
    label: "Email",
    render: (row) => row.email,
  },
  {
    id: "phone",
    label: "Phone",
    render: (row) => row.phone,
  },
  {
    id: "status",
    label: "Status",
    render: (row) => row.status,
  },
  {
    id: "arrival",
    label: "Arrival",
    render: (row) => formatDateForDisplay(row.arrival),
  },
  {
    id: "arrivalTime",
    label: "Arrival Time",
    render: (row) => row.arrivalTime,
  },
  {
    id: "departure",
    label: "Departure",
    render: (row) => formatDateForDisplay(row.departure),
  },
  {
    id: "departureTime",
    label: "Departure Time",
    render: (row) => row.departureTime,
  },
  {
    id: "createdAt",
    label: "Created",
    render: (row) =>
      new Date(row.createdAt ?? row.applicationCreatedAt).toLocaleString(),
  },
  {
    id: "hasBurningManTicket",
    label: "Has BM Ticket",
    render: (row) => (row.hasBurningManTicket ? "Yes" : "No"),
  },
  {
    id: "hasVehiclePass",
    label: "Has Vehicle Pass",
    render: (row) => (row.hasVehiclePass ? "Yes" : "No"),
  },
  {
    id: "requests",
    label: "Requests",
    render: (row) => row.requests || "None",
  },
];

const DATE_OPERATORS: Array<{ value: FilterOperator; label: string }> = [
  { value: "on_or_before", label: "On or before" },
  { value: "on_or_after", label: "On or after" },
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
  { value: "eq", label: "On" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending_payment", label: "Pending payment" },
  { value: "needs_ops_review", label: "Needs ops review" },
  { value: "rejected", label: "Rejected" },
] as const;

type BooleanQuickFilter = "any" | "yes" | "no";
type RequestsQuickFilter = "any" | "has_requests";

function cycleBooleanQuickFilter(current: BooleanQuickFilter): BooleanQuickFilter {
  if (current === "any") {
    return "yes";
  }
  if (current === "yes") {
    return "no";
  }
  return "any";
}

function getBooleanQuickFilterLabel(value: BooleanQuickFilter): string {
  if (value === "yes") {
    return "Yes";
  }
  if (value === "no") {
    return "No";
  }
  return "Any";
}

function cycleRequestsQuickFilter(current: RequestsQuickFilter): RequestsQuickFilter {
  return current === "any" ? "has_requests" : "any";
}

function getRequestsQuickFilterLabel(value: RequestsQuickFilter): string {
  return value === "has_requests" ? "Has requests" : "Any";
}

function cycleStatusFilter(current: string): string {
  const index = STATUS_FILTER_OPTIONS.findIndex((option) => option.value === current);
  const resolvedIndex = index === -1 ? 0 : index;
  const nextIndex = (resolvedIndex + 1) % STATUS_FILTER_OPTIONS.length;
  return STATUS_FILTER_OPTIONS[nextIndex].value;
}

function getStatusFilterLabel(value: string): string {
  if (value === "all") {
    return "Any";
  }
  return (
    STATUS_FILTER_OPTIONS.find((option) => option.value === value)?.label ??
    "Any"
  );
}

function formatDateForDisplay(dateValue?: string) {
  if (!dateValue) {
    return "Not specified";
  }

  const parts = dateValue.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    if ([year, month, day].every(Number.isFinite)) {
      return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }

  return dateValue;
}

function getEventWindowDateBounds(rows: OpsSignupRow[]): DateBounds {
  if (rows.length === 0) {
    return {};
  }

  const arrivals = rows
    .map((row) => row.arrival)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((a, b) => a.localeCompare(b));

  const departures = rows
    .map((row) => row.departure)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((a, b) => a.localeCompare(b));

  if (arrivals.length === 0 || departures.length === 0) {
    return {};
  }

  return {
    min: arrivals[0],
    max: departures[departures.length - 1],
  };
}

export function ExportSignupsTable() {
  const [storedViewState] = useState(() => loadStoredExportViewState());
  const [opsPassword] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(OPS_PASSWORD_KEY);
    }
    return null;
  });
  const [visibleColumns, setVisibleColumns] = useState<SignupColumnId[]>(
    storedViewState?.visibleColumns ?? DEFAULT_SIGNUPS_VIEW_STATE.visibleColumns
  );
  const [arrivalOperator, setArrivalOperator] = useState<FilterOperator>(
    storedViewState?.arrivalOperator ?? "on_or_before"
  );
  const [arrivalDate, setArrivalDate] = useState(storedViewState?.arrivalDate ?? "");
  const [departureOperator, setDepartureOperator] = useState<FilterOperator>(
    storedViewState?.departureOperator ?? "on_or_before"
  );
  const [departureDate, setDepartureDate] = useState(
    storedViewState?.departureDate ?? ""
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    storedViewState?.statusFilter ?? "all"
  );
  const [searchField, setSearchField] = useState<"fullName" | "email" | "phone">(
    storedViewState?.searchField ?? "fullName"
  );
  const [searchValue, setSearchValue] = useState(storedViewState?.searchValue ?? "");
  const [sortField, setSortField] = useState<SignupColumnId>(
    storedViewState?.sortField ?? DEFAULT_SIGNUPS_VIEW_STATE.sort.field
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    storedViewState?.sortDirection ?? DEFAULT_SIGNUPS_VIEW_STATE.sort.direction
  );
  const [hasBurningManTicketFilter, setHasBurningManTicketFilter] =
    useState<BooleanQuickFilter>(
      storedViewState?.hasBurningManTicketFilter ?? "any"
    );
  const [hasVehiclePassFilter, setHasVehiclePassFilter] = useState<BooleanQuickFilter>(
    storedViewState?.hasVehiclePassFilter ?? "any"
  );
  const [requestsFilter, setRequestsFilter] = useState<RequestsQuickFilter>(
    storedViewState?.requestsFilter ?? "any"
  );
  const [lastResolvedSignupsResult, setLastResolvedSignupsResult] = useState<
    SignupsViewResult | undefined
  >(undefined);
  const [lastResolvedBoundsResult, setLastResolvedBoundsResult] = useState<
    SignupsViewResult | undefined
  >(undefined);

  const filters = useMemo(() => {
    const nextFilters: SignupFilter[] = [];

    if (arrivalDate) {
      nextFilters.push({
        field: "arrival",
        operator: arrivalOperator,
        value: arrivalDate,
      });
    }

    if (departureDate) {
      nextFilters.push({
        field: "departure",
        operator: departureOperator,
        value: departureDate,
      });
    }

    if (statusFilter !== "all") {
      nextFilters.push({
        field: "status",
        operator: "eq",
        value: statusFilter,
      });
    }

    if (searchValue.trim()) {
      nextFilters.push({
        field: searchField,
        operator: "contains",
        value: searchValue.trim(),
      });
    }

    if (hasBurningManTicketFilter === "yes") {
      nextFilters.push({
        field: "hasBurningManTicket",
        operator: "eq",
        value: "true",
      });
    } else if (hasBurningManTicketFilter === "no") {
      nextFilters.push({
        field: "hasBurningManTicket",
        operator: "eq",
        value: "false",
      });
    }

    if (hasVehiclePassFilter === "yes") {
      nextFilters.push({
        field: "hasVehiclePass",
        operator: "eq",
        value: "true",
      });
    } else if (hasVehiclePassFilter === "no") {
      nextFilters.push({
        field: "hasVehiclePass",
        operator: "eq",
        value: "false",
      });
    }

    if (requestsFilter === "has_requests") {
      nextFilters.push({
        field: "requests",
        operator: "not_empty",
      });
    }

    return nextFilters;
  }, [
    arrivalDate,
    arrivalOperator,
    departureDate,
    departureOperator,
    searchField,
    searchValue,
    statusFilter,
    hasBurningManTicketFilter,
    hasVehiclePassFilter,
    requestsFilter,
  ]);

  const serverViewState = useMemo(
    () =>
      normalizeSignupViewState({
        // Column visibility is UI-only and should not trigger server re-fetches.
        visibleColumns: DEFAULT_SIGNUPS_VIEW_STATE.visibleColumns,
        filters,
        sort: {
          field: sortField,
          direction: sortDirection,
        },
        limit: DEFAULT_SIGNUPS_VIEW_STATE.limit,
      }),
    [filters, sortDirection, sortField]
  );

  const signupsResult = useQuery(
    api.applications.listSignupsForOpsView,
    opsPassword
      ? {
          opsPassword,
          viewState: serverViewState,
          limit: serverViewState.limit,
        }
      : "skip"
  ) as SignupsViewResult | undefined;

  const boundsResult = useQuery(
    api.applications.listSignupsForOpsView,
    opsPassword
      ? {
          opsPassword,
          viewState: normalizeSignupViewState({
            visibleColumns: DEFAULT_SIGNUPS_VIEW_STATE.visibleColumns,
            filters: [],
            sort: DEFAULT_SIGNUPS_VIEW_STATE.sort,
            limit: DEFAULT_SIGNUPS_VIEW_STATE.limit,
          }),
          limit: DEFAULT_SIGNUPS_VIEW_STATE.limit,
        }
      : "skip"
  ) as SignupsViewResult | undefined;

  useEffect(() => {
    if (signupsResult !== undefined) {
      setLastResolvedSignupsResult(signupsResult);
    }
  }, [signupsResult]);

  useEffect(() => {
    if (boundsResult !== undefined) {
      setLastResolvedBoundsResult(boundsResult);
    }
  }, [boundsResult]);

  const resolvedResult = signupsResult ?? lastResolvedSignupsResult;
  const isInitialLoading = signupsResult === undefined && !lastResolvedSignupsResult;
  const isRefreshing = signupsResult === undefined && !!lastResolvedSignupsResult;
  const resolvedBoundsResult = boundsResult ?? lastResolvedBoundsResult;
  const eventWindowDateBounds = getEventWindowDateBounds(resolvedBoundsResult?.rows ?? []);

  const selectedColumns = useMemo(() => {
    const selected = COLUMN_DEFINITIONS.filter((column) =>
      visibleColumns.includes(column.id)
    );
    return selected.length > 0 ? selected : [COLUMN_DEFINITIONS[0]];
  }, [visibleColumns]);

  useEffect(() => {
    saveExportViewState({
      visibleColumns,
      arrivalOperator,
      arrivalDate,
      departureOperator,
      departureDate,
      statusFilter,
      searchField,
      searchValue,
      sortField,
      sortDirection,
      hasBurningManTicketFilter,
      hasVehiclePassFilter,
      requestsFilter,
    });
  }, [
    arrivalDate,
    arrivalOperator,
    departureDate,
    departureOperator,
    searchField,
    searchValue,
    sortDirection,
    sortField,
    statusFilter,
    visibleColumns,
    hasBurningManTicketFilter,
    hasVehiclePassFilter,
    requestsFilter,
  ]);

  const clearFilters = () => {
    setArrivalOperator("on_or_before");
    setArrivalDate("");
    setDepartureOperator("on_or_before");
    setDepartureDate("");
    setStatusFilter("all");
    setSearchField("fullName");
    setSearchValue("");
    setSortField(DEFAULT_SIGNUPS_VIEW_STATE.sort.field);
    setSortDirection(DEFAULT_SIGNUPS_VIEW_STATE.sort.direction);
    setHasBurningManTicketFilter("any");
    setHasVehiclePassFilter("any");
    setRequestsFilter("any");
  };

  const toggleColumn = (columnId: SignupColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        if (currentColumns.length === 1) {
          return currentColumns;
        }
        return currentColumns.filter((currentColumn) => currentColumn !== columnId);
      }

      return [...currentColumns, columnId];
    });
  };

  const handleToggleHeaderBooleanFilter = (
    columnId: "hasBurningManTicket" | "hasVehiclePass"
  ) => {
    if (columnId === "hasBurningManTicket") {
      setHasBurningManTicketFilter((current) => cycleBooleanQuickFilter(current));
      return;
    }
    setHasVehiclePassFilter((current) => cycleBooleanQuickFilter(current));
  };

  const handleExportCurrentView = () => {
    if (!resolvedResult || resolvedResult.rows.length === 0) {
      return;
    }

    const csv = buildSignupCsv(
      resolvedResult.rows,
      selectedColumns.map((column) => ({
        key: column.id,
        header: column.label,
        getValue: column.render,
      }))
    );
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`signups-export-${today}.csv`, csv);
  };

  if (!opsPassword) {
    return (
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-6">
        <p className="text-sm text-amber-300">
          Ops password not found in session. Please refresh and sign in again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Flexible Signups View</h2>
            <p className="mt-1 text-xs text-slate-400">
              {resolvedResult
                ? `Showing ${resolvedResult.totalAfterFilter} of ${resolvedResult.totalBeforeFilter} signup rows.`
                : "Loading signup rows..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isRefreshing && (
              <span className="text-xs text-slate-400">Refreshing...</span>
            )}
            <button
              type="button"
              onClick={handleExportCurrentView}
              disabled={isRefreshing || !resolvedResult || resolvedResult.rows.length === 0}
              className={clsx(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                isRefreshing || !resolvedResult || resolvedResult.rows.length === 0
                  ? "bg-emerald-500/20 text-emerald-200/60 cursor-not-allowed"
                  : "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
              )}
            >
              Export current view
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 text-slate-200 hover:bg-white/20 transition-colors"
            >
              Reset view
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg bg-black/20 ring-1 ring-white/10 p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Filters
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-300">
                Arrival Operator
                <select
                  aria-label="Arrival Operator"
                  value={arrivalOperator}
                  onChange={(event) =>
                    setArrivalOperator(event.target.value as FilterOperator)
                  }
                  className="mt-1 w-full rounded bg-slate-900 border border-white/10 px-2 py-1.5 text-sm text-white"
                >
                  {DATE_OPERATORS.map((operator) => (
                    <option key={operator.value} value={operator.value}>
                      {operator.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-300">
                Arrival Date
                <input
                  aria-label="Arrival Date"
                  type="date"
                  value={arrivalDate}
                  onChange={(event) => setArrivalDate(event.target.value)}
                  min={eventWindowDateBounds.min}
                  max={eventWindowDateBounds.max}
                  className="mt-1 w-full rounded bg-slate-900 border border-white/10 px-2 py-1.5 text-sm text-white"
                />
              </label>
              <label className="text-xs text-slate-300">
                Departure Operator
                <select
                  aria-label="Departure Operator"
                  value={departureOperator}
                  onChange={(event) =>
                    setDepartureOperator(event.target.value as FilterOperator)
                  }
                  className="mt-1 w-full rounded bg-slate-900 border border-white/10 px-2 py-1.5 text-sm text-white"
                >
                  {DATE_OPERATORS.map((operator) => (
                    <option key={operator.value} value={operator.value}>
                      {operator.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-300">
                Departure Date
                <input
                  aria-label="Departure Date"
                  type="date"
                  value={departureDate}
                  onChange={(event) => setDepartureDate(event.target.value)}
                  min={eventWindowDateBounds.min}
                  max={eventWindowDateBounds.max}
                  className="mt-1 w-full rounded bg-slate-900 border border-white/10 px-2 py-1.5 text-sm text-white"
                />
              </label>
              <label className="text-xs text-slate-300">
                Status
                <select
                  aria-label="Status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="mt-1 w-full rounded bg-slate-900 border border-white/10 px-2 py-1.5 text-sm text-white"
                >
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-300">
                Search Field
                <select
                  aria-label="Search Field"
                  value={searchField}
                  onChange={(event) =>
                    setSearchField(event.target.value as "fullName" | "email" | "phone")
                  }
                  className="mt-1 w-full rounded bg-slate-900 border border-white/10 px-2 py-1.5 text-sm text-white"
                >
                  <option value="fullName">Name</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </select>
              </label>
              <label className="text-xs text-slate-300 sm:col-span-2">
                Search
                <input
                  aria-label="Search"
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Contains..."
                  className="mt-1 w-full rounded bg-slate-900 border border-white/10 px-2 py-1.5 text-sm text-white placeholder:text-slate-500"
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg bg-black/20 ring-1 ring-white/10 p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Columns And Sort
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-300">
                Sort Field
                <select
                  aria-label="Sort Field"
                  value={sortField}
                  onChange={(event) => setSortField(event.target.value as SignupColumnId)}
                  className="mt-1 w-full rounded bg-slate-900 border border-white/10 px-2 py-1.5 text-sm text-white"
                >
                  {COLUMN_DEFINITIONS.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-300">
                Sort Direction
                <select
                  aria-label="Sort Direction"
                  value={sortDirection}
                  onChange={(event) =>
                    setSortDirection(event.target.value as SortDirection)
                  }
                  className="mt-1 w-full rounded bg-slate-900 border border-white/10 px-2 py-1.5 text-sm text-white"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {COLUMN_DEFINITIONS.map((column) => {
                const checked = visibleColumns.includes(column.id);
                return (
                  <label
                    key={column.id}
                    className={clsx(
                      "flex items-center gap-2 rounded px-2 py-1.5 text-xs ring-1 transition-colors",
                      checked
                        ? "bg-emerald-500/10 ring-emerald-500/30 text-emerald-100"
                        : "bg-white/5 ring-white/10 text-slate-300"
                    )}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Show ${column.label}`}
                      checked={checked}
                      onChange={() => toggleColumn(column.id)}
                    />
                    {column.label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {isInitialLoading || !resolvedResult ? (
        <div className="text-center py-12 rounded-xl bg-white/5 ring-1 ring-white/10">
          <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-slate-400">Loading signups view...</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[920px] divide-y divide-white/10">
              <thead>
                <tr>
                  {selectedColumns.map((column) => (
                    <th
                      key={column.id}
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                    >
                      <div className="flex flex-col gap-1">
                        <span>{column.label}</span>
                        {column.id === "hasBurningManTicket" && (
                          <button
                            type="button"
                            aria-label={`Filter Has BM Ticket: ${getBooleanQuickFilterLabel(
                              hasBurningManTicketFilter
                            )}`}
                            onClick={() =>
                              handleToggleHeaderBooleanFilter("hasBurningManTicket")
                            }
                            className="w-fit rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-200 hover:bg-white/20"
                          >
                            Filter: {getBooleanQuickFilterLabel(hasBurningManTicketFilter)}
                          </button>
                        )}
                        {column.id === "hasVehiclePass" && (
                          <button
                            type="button"
                            aria-label={`Filter Has Vehicle Pass: ${getBooleanQuickFilterLabel(
                              hasVehiclePassFilter
                            )}`}
                            onClick={() =>
                              handleToggleHeaderBooleanFilter("hasVehiclePass")
                            }
                            className="w-fit rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-200 hover:bg-white/20"
                          >
                            Filter: {getBooleanQuickFilterLabel(hasVehiclePassFilter)}
                          </button>
                        )}
                        {column.id === "requests" && (
                          <button
                            type="button"
                            aria-label={`Filter Requests: ${getRequestsQuickFilterLabel(
                              requestsFilter
                            )}`}
                            onClick={() =>
                              setRequestsFilter((current) =>
                                cycleRequestsQuickFilter(current)
                              )
                            }
                            className="w-fit rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-200 hover:bg-white/20"
                          >
                            Filter: {getRequestsQuickFilterLabel(requestsFilter)}
                          </button>
                        )}
                        {column.id === "status" && (
                          <button
                            type="button"
                            aria-label={`Filter Status: ${getStatusFilterLabel(statusFilter)}`}
                            onClick={() =>
                              setStatusFilter((current) => cycleStatusFilter(current))
                            }
                            className="w-fit rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-200 hover:bg-white/20"
                          >
                            Filter: {getStatusFilterLabel(statusFilter)}
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {resolvedResult.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={selectedColumns.length}
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      No signups match the selected view settings.
                    </td>
                  </tr>
                ) : (
                  resolvedResult.rows.map((row) => (
                    <tr key={row._id} className="hover:bg-white/5 transition-colors">
                      {selectedColumns.map((column) => (
                        <td
                          key={`${row._id}:${column.id}`}
                          className="px-4 py-3 text-sm text-slate-200"
                        >
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {isRefreshing && (
            <div className="border-t border-white/10 bg-black/20 px-4 py-2 text-xs text-slate-400">
              Updating table...
            </div>
          )}
        </div>
      )}

      {resolvedResult?.truncated && (
        <p className="text-xs text-amber-300">
          Result set hit the current server limit. Narrow filters for complete export coverage.
        </p>
      )}
    </div>
  );
}
