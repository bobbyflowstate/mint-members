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

    return nextFilters;
  }, [
    arrivalDate,
    arrivalOperator,
    departureDate,
    departureOperator,
    searchField,
    searchValue,
    statusFilter,
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

  const resolvedResult = signupsResult;
  const isLoading = signupsResult === undefined;
  const eventWindowDateBounds = getEventWindowDateBounds(boundsResult?.rows ?? []);

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
            {isLoading && (
              <span className="text-xs text-slate-400">Refreshing...</span>
            )}
            <button
              type="button"
              onClick={handleExportCurrentView}
              disabled={isLoading || !resolvedResult || resolvedResult.rows.length === 0}
              className={clsx(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                isLoading || !resolvedResult || resolvedResult.rows.length === 0
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
                  <option value="all">All</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending_payment">Pending payment</option>
                  <option value="needs_ops_review">Needs ops review</option>
                  <option value="rejected">Rejected</option>
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

      {isLoading ? (
        <div className="text-center py-12 rounded-xl bg-white/5 ring-1 ring-white/10">
          <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-slate-400">Loading signups view...</p>
        </div>
      ) : resolvedResult && resolvedResult.rows.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-white/5 ring-1 ring-white/10">
          <p className="text-slate-400">No signups match the selected view settings.</p>
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
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {resolvedResult?.rows.map((row) => (
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
                ))}
              </tbody>
            </table>
          </div>
          {isLoading && (
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
