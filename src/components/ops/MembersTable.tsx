"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import clsx from "clsx";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  DEFAULT_SIGNUPS_VIEW_STATE,
  SignupColumnId,
  normalizeSignupViewState,
} from "../../lib/opsSignupsView/types";
import { buildSignupCsv, downloadCsv } from "../../lib/opsSignupsView/csv";
import { formatDateWithWeekday } from "../../lib/dates/formatDateWithWeekday";
import { AddManualMemberModal } from "./AddManualMemberModal";

const OPS_PASSWORD_KEY = "ops_password";

type StatusTab = "all" | "needs_full_payment" | "needs_ops_review" | "confirmed" | "invited" | "cancelled";

interface OpsSignupRow {
  _id: string;
  _source?: "signup" | "invite";
  applicationId?: string;
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
  paymentAllowed: boolean;
  hasFullPayment?: boolean;
  hasBurningManTicket: boolean;
  hasVehiclePass: boolean;
  requests: string;
  memberType?: "alumni" | "newbie";
  cancelled?: boolean;
  sponsorName?: string;
  addedBy?: string;
  notes?: string;
}

interface DateStat {
  date: string;
  count: number;
}

interface ColumnDef {
  id: SignupColumnId;
  header: string;
  renderText: (row: OpsSignupRow) => string;
  renderCell: (row: OpsSignupRow) => React.ReactNode;
  multiline?: boolean;
}

function formatDate(dateValue: string | undefined) {
  if (!dateValue) return "—";
  const parts = dateValue.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    if ([y, m, d].every(Number.isFinite)) {
      return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }
  }
  return dateValue;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" };
    case "pending_payment":
      return { label: "Pending", cls: "bg-amber-500/15 text-amber-300 ring-amber-400/30" };
    case "needs_ops_review":
      return { label: "Needs Review", cls: "bg-orange-500/15 text-orange-300 ring-orange-400/30" };
    case "rejected":
      return { label: "Rejected", cls: "bg-red-500/15 text-red-300 ring-red-400/30" };
    case "invited":
      return { label: "Invited", cls: "bg-violet-500/15 text-violet-300 ring-violet-400/30" };
    default:
      return { label: status, cls: "bg-slate-500/10 text-slate-300 ring-slate-400/30" };
  }
}

function buildDateStats(rows: OpsSignupRow[], field: "arrival" | "departure"): DateStat[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const val = row[field];
    if (val) counts.set(val, (counts.get(val) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface UndoToast {
  id: number;
  message: string;
  onUndo: () => void;
}

function Toast({ toast, onDismiss }: { toast: UndoToast; onDismiss: () => void }) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());
  const DURATION = 8000;

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);
    return () => clearInterval(interval);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm">
      <div className="rounded-xl bg-slate-800 ring-1 ring-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm text-white">{toast.message}</p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { toast.onUndo(); onDismiss(); }}
              className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div
          className="h-0.5 bg-emerald-500 transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function PaidCell({
  row,
  onToggle,
}: {
  row: OpsSignupRow;
  onToggle: (row: OpsSignupRow, val: boolean) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const canToggle =
    !row.cancelled &&
    (row._source === "invite" ||
      row.status === "confirmed" ||
      row.status === "pending_payment" ||
      row.status === "payment_processing");
  if (row.cancelled) return <span className="text-xs text-red-300">Cancelled</span>;
  if (!canToggle) return <span className="text-xs text-slate-500">—</span>;

  const handleToggle = async () => {
    setLoading(true);
    try {
      await onToggle(row, !row.hasFullPayment);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1",
          row.hasFullPayment
            ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
            : "bg-slate-500/10 text-slate-400 ring-slate-400/20"
        )}
      >
        {row.hasFullPayment ? "Paid in Full" : "Outstanding"}
      </span>
      <button
        type="button"
        onClick={() => { void handleToggle(); }}
        disabled={loading}
        className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-40"
      >
        {loading ? "..." : row.hasFullPayment ? "Mark Outstanding" : "Mark Paid"}
      </button>
    </div>
  );
}

const COLUMN_DEFS: ColumnDef[] = [
  // Identity
  {
    id: "fullName",
    header: "Name",
    renderText: (r) => r.fullName,
    renderCell: (r) => <span className="text-sm font-medium text-white">{r.fullName}</span>,
  },
  {
    id: "email",
    header: "Email",
    renderText: (r) => r.email,
    renderCell: (r) => <span className="text-sm text-slate-300">{r.email}</span>,
  },
  {
    id: "phone",
    header: "Phone",
    renderText: (r) => r.phone,
    renderCell: (r) => <span className="text-sm text-slate-300">{r.phone}</span>,
  },
  // Member
  {
    id: "memberType",
    header: "Type",
    renderText: (r) => (r.memberType === "newbie" ? "Newbie" : "Alumni"),
    renderCell: (r) => (
      <span
        className={clsx(
          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1",
          r.memberType === "newbie"
            ? "bg-sky-500/10 text-sky-200 ring-sky-400/30"
            : "bg-amber-500/10 text-amber-200 ring-amber-400/30"
        )}
      >
        {r.memberType === "newbie" ? "Newbie" : "Alumni"}
      </span>
    ),
  },
  {
    id: "sponsorName",
    header: "Sponsor",
    renderText: (r) => r.sponsorName ?? "",
    renderCell: (r) => <span className="text-sm text-slate-400">{r.sponsorName ?? "—"}</span>,
  },
  // Application
  {
    id: "status",
    header: "Application Status",
    renderText: (r) => (r.cancelled ? "Cancelled" : r.status),
    renderCell: (r) => {
      const badge = r.cancelled
        ? { label: "Cancelled", cls: "bg-red-500/15 text-red-300 ring-red-400/30" }
        : getStatusBadge(r.status);
      return (
        <span className={clsx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1", badge.cls)}>
          {badge.label}
        </span>
      );
    },
  },
  {
    id: "createdAt",
    header: "Applied At",
    renderText: (r) => new Date(r.createdAt ?? r.applicationCreatedAt).toLocaleString(),
    renderCell: (r) => (
      <span className="text-sm text-slate-400">
        {new Date(r.createdAt ?? r.applicationCreatedAt).toLocaleDateString()}
      </span>
    ),
  },
  // Payment
  {
    id: "hasFullPayment",
    header: "Full Payment",
    renderText: (r) => {
      const eligible =
        r._source === "invite" ||
        r.status === "confirmed" ||
        r.status === "pending_payment" ||
        r.status === "payment_processing";
      return eligible ? (r.hasFullPayment ? "Paid in Full" : "Outstanding") : "";
    },
    renderCell: () => null, // rendered via PaidCell in the table loop
  },
  // Dates
  {
    id: "arrival",
    header: "Arrival",
    multiline: true,
    renderText: (r) => `${r.arrival} ${r.arrivalTime}`.trim(),
    renderCell: (r) => (
      <>
        <div className="text-sm text-slate-200">{formatDate(r.arrival)}</div>
        <div className="text-xs text-slate-500">{r.arrivalTime}</div>
      </>
    ),
  },
  {
    id: "departure",
    header: "Departure",
    multiline: true,
    renderText: (r) => `${r.departure} ${r.departureTime}`.trim(),
    renderCell: (r) => (
      <>
        <div className="text-sm text-slate-200">{formatDate(r.departure)}</div>
        <div className="text-xs text-slate-500">{r.departureTime}</div>
      </>
    ),
  },
  // Camp logistics
  {
    id: "hasBurningManTicket",
    header: "BM Ticket",
    renderText: (r) => (r.hasBurningManTicket ? "Yes" : "No"),
    renderCell: (r) => (
      <span
        className={clsx(
          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1",
          r.hasBurningManTicket
            ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
            : "bg-slate-500/10 text-slate-400 ring-slate-400/20"
        )}
      >
        {r.hasBurningManTicket ? "Yes" : "No"}
      </span>
    ),
  },
  {
    id: "hasVehiclePass",
    header: "Vehicle Pass",
    renderText: (r) => (r.hasVehiclePass ? "Yes" : "No"),
    renderCell: (r) => (
      <span
        className={clsx(
          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1",
          r.hasVehiclePass
            ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
            : "bg-slate-500/10 text-slate-400 ring-slate-400/20"
        )}
      >
        {r.hasVehiclePass ? "Yes" : "No"}
      </span>
    ),
  },
  {
    id: "requests",
    header: "Requests",
    renderText: (r) => r.requests || "",
    renderCell: (r) =>
      r.requests?.trim() ? (
        <span className="text-xs text-amber-200 bg-amber-500/10 rounded px-2 py-0.5 ring-1 ring-amber-400/30">
          {r.requests}
        </span>
      ) : (
        <span className="text-xs text-slate-500">—</span>
      ),
  },
];

const DEFAULT_VISIBLE_COLUMN_IDS: SignupColumnId[] = [
  "fullName",
  "email",
  "phone",
  "memberType",
  "status",
  "hasFullPayment",
  "arrival",
  "departure",
];

const STATUS_TABS: Array<{ id: StatusTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "confirmed", label: "Fully Paid" },
  { id: "needs_full_payment", label: "Need Full Payment" },
  { id: "cancelled", label: "Cancelled" },
  { id: "invited", label: "Invited" },
  { id: "needs_ops_review", label: "Needs Review" },
];

const ALL_ROWS_VIEW_STATE = normalizeSignupViewState({
  visibleColumns: DEFAULT_SIGNUPS_VIEW_STATE.visibleColumns,
  filters: [],
  sort: DEFAULT_SIGNUPS_VIEW_STATE.sort,
  limit: 5000,
});

export function MembersTable() {
  const [opsPassword] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(OPS_PASSWORD_KEY) : null
  );

  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [selectedArrivalDates, setSelectedArrivalDates] = useState<string[]>([]);
  const [selectedDepartureDates, setSelectedDepartureDates] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = useState<SignupColumnId[]>(DEFAULT_VISIBLE_COLUMN_IDS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [cancellingRowId, setCancellingRowId] = useState<string | null>(null);
  const [toast, setToast] = useState<UndoToast | null>(null);
  const toastIdRef = useRef(0);

  const result = useQuery(
    api.applications.listSignupsForOpsView,
    opsPassword ? { opsPassword, viewState: ALL_ROWS_VIEW_STATE, limit: 5000 } : "skip"
  );

  const invitesResult = useQuery(
    api.opsManualInvites.listUnclaimedForOps,
    opsPassword ? { opsPassword } : "skip"
  );

  const setConfirmedFullPayment = useMutation(api.confirmedMembers.setFullPayment);
  const setInviteFullPayment = useMutation(api.opsManualInvites.setFullPayment);
  const setConfirmedCancelled = useMutation(api.confirmedMembers.setCancelledForOps);
  const setInviteCancelled = useMutation(api.opsManualInvites.setCancelledForOps);

  const applyFullPayment = async (row: OpsSignupRow, hasFullPayment: boolean) => {
    if (!opsPassword) return;
    if (row._source === "invite") {
      await setInviteFullPayment({ opsPassword, inviteId: row._id as Id<"ops_manual_invites">, hasFullPayment });
    } else if (row.applicationId) {
      await setConfirmedFullPayment({ opsPassword, applicationId: row.applicationId as Id<"applications">, hasFullPayment });
    }
  };

  const handleTogglePaid = async (row: OpsSignupRow, hasFullPayment: boolean) => {
    await applyFullPayment(row, hasFullPayment);
    const id = ++toastIdRef.current;
    const label = hasFullPayment ? "Paid in Full" : "Outstanding";
    setToast({
      id,
      message: `Marked ${row.fullName} as ${label}`,
      onUndo: () => { void applyFullPayment(row, !hasFullPayment); },
    });
  };

  const handleToggleCancelled = async (
    row: OpsSignupRow,
    options?: { nextCancelled?: boolean; skipConfirm?: boolean }
  ) => {
    if (!opsPassword) return;

    const cancelled = options?.nextCancelled ?? !row.cancelled;
    if (cancelled && !options?.skipConfirm) {
      const confirmed = window.confirm(
        `Cancel ${row.fullName}? This will block their member access and payment flow.`
      );
      if (!confirmed) return;
    }

    setCancellingRowId(row._id);
    try {
      if (row._source === "invite") {
        await setInviteCancelled({
          opsPassword,
          inviteId: row._id as Id<"ops_manual_invites">,
          cancelled,
        });
      } else {
        const applicationId = row.applicationId ?? row._id;
        await setConfirmedCancelled({
          opsPassword,
          applicationId: applicationId as Id<"applications">,
          cancelled,
        });
      }

      const id = ++toastIdRef.current;
      setToast({
        id,
        message: `${row.fullName} marked ${cancelled ? "Cancelled" : "Active"}`,
        onUndo: () => {
          void handleToggleCancelled(row, {
            nextCancelled: !cancelled,
            skipConfirm: true,
          });
        },
      });
    } catch (error) {
      console.error("Failed to update cancellation:", error);
      alert(`Failed to update cancellation: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setCancellingRowId(null);
    }
  };

  const allRows = useMemo(() => (result?.rows ?? []) as OpsSignupRow[], [result]);

  const allInviteRows = useMemo<OpsSignupRow[]>(() => {
    if (!invitesResult) return [];
    return invitesResult.map((inv) => ({
      _id: inv._id,
      _source: "invite" as const,
      applicationId: undefined,
      firstName: inv.firstName,
      lastName: inv.lastName,
      fullName: `${inv.firstName} ${inv.lastName}`,
      email: inv.email,
      phone: inv.phone,
      arrival: inv.arrival,
      arrivalTime: inv.arrivalTime,
      departure: inv.departure,
      departureTime: inv.departureTime,
      status: "invited",
      applicationCreatedAt: inv.createdAt,
      createdAt: inv.createdAt,
      paymentAllowed: false,
      hasFullPayment: inv.hasFullPayment,
      hasBurningManTicket: false,
      hasVehiclePass: false,
      requests: "",
      memberType: inv.memberType,
      cancelled: inv.cancelled,
      addedBy: inv.addedBy,
      notes: inv.notes,
    }));
  }, [invitesResult]);

  const combinedRows = useMemo<OpsSignupRow[]>(
    () => [...allRows, ...allInviteRows],
    [allRows, allInviteRows]
  );

  const statusCounts = useMemo(() => {
    const counts = { all: 0, needs_full_payment: 0, needs_ops_review: 0, confirmed: 0, invited: 0, cancelled: 0 };
    for (const row of combinedRows) {
      counts.all++;
      if (row.cancelled) {
        counts.cancelled++;
      } else if (row.hasFullPayment) {
        counts.confirmed++;
      } else {
        counts.needs_full_payment++;
      }
      if (!row.cancelled && row.status === "needs_ops_review") counts.needs_ops_review++;
      else if (!row.cancelled && row.status === "invited") counts.invited++;
    }
    return counts;
  }, [combinedRows]);

  const statusFilteredRows = useMemo(() => {
    if (statusTab === "all") return combinedRows;
    if (statusTab === "confirmed") return combinedRows.filter((r) => !r.cancelled && r.hasFullPayment);
    if (statusTab === "needs_full_payment") return combinedRows.filter((r) => !r.cancelled && !r.hasFullPayment);
    if (statusTab === "cancelled") return combinedRows.filter((r) => r.cancelled);
    if (statusTab === "invited") return allInviteRows.filter((r) => !r.cancelled);
    return allRows.filter((r) => !r.cancelled && r.status === statusTab);
  }, [combinedRows, allRows, allInviteRows, statusTab]);

  const arrivalStats = useMemo(() => buildDateStats(statusFilteredRows, "arrival"), [statusFilteredRows]);
  const departureStats = useMemo(() => buildDateStats(statusFilteredRows, "departure"), [statusFilteredRows]);

  const filteredRows = useMemo(() => {
    return statusFilteredRows.filter((row) => {
      if (selectedArrivalDates.length > 0 && !selectedArrivalDates.includes(row.arrival)) return false;
      if (selectedDepartureDates.length > 0 && !selectedDepartureDates.includes(row.departure)) return false;
      if (searchValue.trim()) {
        const q = searchValue.trim().toLowerCase();
        if (!row.fullName.toLowerCase().includes(q) && !row.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [statusFilteredRows, selectedArrivalDates, selectedDepartureDates, searchValue]);

  const visibleColumnDefs = useMemo(
    () => COLUMN_DEFS.filter((c) => visibleColumnIds.includes(c.id)),
    [visibleColumnIds]
  );

  const isInvitedTab = statusTab === "invited";
  const hasDateFilters = selectedArrivalDates.length > 0 || selectedDepartureDates.length > 0;
  const hasActiveFilters = hasDateFilters || !!searchValue.trim();

  const clearDateFilters = () => {
    setSelectedArrivalDates([]);
    setSelectedDepartureDates([]);
  };

  const handleTabChange = (tab: StatusTab) => {
    setStatusTab(tab);
    clearDateFilters();
  };

  const toggleColumn = (id: SignupColumnId) => {
    setVisibleColumnIds((prev) =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter((c) => c !== id) : prev
        : [...prev, id]
    );
  };

  const handleExport = () => {
    if (!filteredRows.length) return;
    const cols = visibleColumnDefs.flatMap((c) => {
      if (c.id === "arrival") {
        return [
          { key: "arrivalDate", header: "Arrival Date", getValue: (r: OpsSignupRow) => r.arrival },
          { key: "arrivalTime", header: "Arrival Time", getValue: (r: OpsSignupRow) => r.arrivalTime },
        ];
      }
      if (c.id === "departure") {
        return [
          { key: "departureDate", header: "Departure Date", getValue: (r: OpsSignupRow) => r.departure },
          { key: "departureTime", header: "Departure Time", getValue: (r: OpsSignupRow) => r.departureTime },
        ];
      }
      return [{ key: c.id, header: c.header, getValue: c.renderText }];
    });
    const csv = buildSignupCsv(filteredRows, cols);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`members-${statusTab}-${today}.csv`, csv);
  };

  const isVisible = (id: SignupColumnId) => visibleColumnIds.includes(id);

  if (!opsPassword || result === undefined || invitesResult === undefined) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-slate-400">Loading members...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full max-w-xs rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 ring-1 ring-emerald-400/30 transition-colors"
          >
            + Add Member
          </button>
          <button
            type="button"
            onClick={() => setShowColumnsPanel((v) => !v)}
            className={clsx(
              "px-3 py-2 text-sm font-medium rounded-lg transition-colors ring-1",
              showColumnsPanel
                ? "bg-white/15 text-white ring-white/20"
                : "bg-white/5 text-slate-200 ring-white/10 hover:bg-white/10"
            )}
          >
            Columns
          </button>
        </div>
      </div>

      {/* Columns panel */}
      {showColumnsPanel && (
        <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Visible Columns</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{filteredRows.length} rows</span>
              <button
                type="button"
                onClick={handleExport}
                disabled={!filteredRows.length}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Download CSV
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {COLUMN_DEFS.map((col) => {
              const checked = visibleColumnIds.includes(col.id);
              return (
                <label
                  key={col.id}
                  className={clsx(
                    "flex items-center gap-2 rounded px-2 py-1.5 text-xs ring-1 cursor-pointer transition-colors",
                    checked
                      ? "bg-emerald-500/10 ring-emerald-500/30 text-emerald-100"
                      : "bg-white/5 ring-white/10 text-slate-300 hover:bg-white/10"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleColumn(col.id)}
                    className="rounded"
                  />
                  {col.header}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap rounded-xl bg-white/5 ring-1 ring-white/10 p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={clsx(
              "flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 min-w-0",
              statusTab === tab.id
                ? "bg-white/15 text-white"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <span className="truncate">{tab.label}</span>
            <span
              className={clsx(
                "text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                statusTab === tab.id ? "bg-white/20 text-white" : "bg-white/10 text-slate-500"
              )}
            >
              {statusCounts[tab.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Date breakdown */}
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Date Breakdown
          </h3>
          {hasDateFilters && (
            <button
              type="button"
              onClick={clearDateFilters}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Arrival</p>
            {arrivalStats.length === 0 ? (
              <p className="text-xs text-slate-600">No data</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {arrivalStats.map((stat) => {
                  const sel = selectedArrivalDates.includes(stat.date);
                  return (
                    <button
                      key={stat.date}
                      type="button"
                      onClick={() =>
                        setSelectedArrivalDates((prev) =>
                          prev.includes(stat.date) ? prev.filter((d) => d !== stat.date) : [...prev, stat.date]
                        )
                      }
                      aria-pressed={sel}
                      className={clsx(
                        "rounded-lg px-3 py-2 text-left transition-colors ring-1",
                        sel
                          ? "ring-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                          : "ring-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
                      )}
                    >
                      <div className="text-xs">{formatDateWithWeekday(stat.date)}</div>
                      <div className="mt-0.5 text-lg font-semibold">{stat.count}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Departure</p>
            {departureStats.length === 0 ? (
              <p className="text-xs text-slate-600">No data</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {departureStats.map((stat) => {
                  const sel = selectedDepartureDates.includes(stat.date);
                  return (
                    <button
                      key={stat.date}
                      type="button"
                      onClick={() =>
                        setSelectedDepartureDates((prev) =>
                          prev.includes(stat.date) ? prev.filter((d) => d !== stat.date) : [...prev, stat.date]
                        )
                      }
                      aria-pressed={sel}
                      className={clsx(
                        "rounded-lg px-3 py-2 text-left transition-colors ring-1",
                        sel
                          ? "ring-sky-400/50 bg-sky-500/20 text-sky-100"
                          : "ring-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
                      )}
                    >
                      <div className="text-xs">{formatDateWithWeekday(stat.date)}</div>
                      <div className="mt-0.5 text-lg font-semibold">{stat.count}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter summary */}
      {hasActiveFilters && (
        <p className="text-xs text-slate-400">
          Showing {filteredRows.length} of {statusFilteredRows.length}
          {hasDateFilters ? " — date filter active" : ""}
          {searchValue.trim() ? ` — searching "${searchValue.trim()}"` : ""}
        </p>
      )}

      {/* Content */}
      {combinedRows.length === 0 ? (
        <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-12 text-center">
          <p className="text-slate-400">No members yet.</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-12 text-center">
          <p className="text-slate-400">No members match the current filters.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead>
                  <tr className="bg-white/5">
                    {visibleColumnDefs.map((col) => (
                      <th
                        key={col.id}
                        className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {col.header}
                      </th>
                    ))}
                    {isInvitedTab && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Added By
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Notes
                        </th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredRows.map((row) => (
                    <tr key={row._id} className="hover:bg-white/5 transition-colors">
                      {visibleColumnDefs.map((col) => (
                        <td
                          key={col.id}
                          className={clsx("px-4 py-3", col.multiline ? "" : "whitespace-nowrap")}
                        >
                          {col.id === "hasFullPayment" ? (
                            <PaidCell
                              row={row}
                              onToggle={handleTogglePaid}
                            />
                          ) : (
                            col.renderCell(row)
                          )}
                        </td>
                      ))}
                      {isInvitedTab && (
                        <>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400">
                            {row.addedBy ?? "—"}
                          </td>
                          <td className="px-4 py-3 max-w-[200px] text-sm text-slate-400">
                            {row.notes ?? "—"}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => { void handleToggleCancelled(row); }}
                          disabled={cancellingRowId === row._id}
                          className={clsx(
                            "text-xs font-medium transition-colors disabled:opacity-40",
                            row.cancelled
                              ? "text-emerald-300 hover:text-emerald-200"
                              : "text-red-300 hover:text-red-200"
                          )}
                        >
                          {row.cancelled ? "Reinstate" : "Cancel"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredRows.map((row) => {
              const badge = row.cancelled
                ? { label: "Cancelled", cls: "bg-red-500/15 text-red-300 ring-red-400/30" }
                : getStatusBadge(row.status);
              return (
                <article
                  key={row._id}
                  className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{row.fullName}</h3>
                      <p className="text-xs text-slate-400">{row.email}</p>
                    </div>
                    {isVisible("status") && (
                      <span
                        className={clsx(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 shrink-0",
                          badge.cls
                        )}
                      >
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <dl className="grid gap-1.5 text-xs">
                    {isVisible("phone") && (
                      <div className="flex gap-2">
                        <dt className="text-slate-500 w-20 shrink-0">Phone</dt>
                        <dd className="text-slate-300">{row.phone}</dd>
                      </div>
                    )}
                    {isVisible("memberType") && (
                      <div className="flex gap-2">
                        <dt className="text-slate-500 w-20 shrink-0">Type</dt>
                        <dd>
                          <span
                            className={clsx(
                              "rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                              row.memberType === "newbie"
                                ? "bg-sky-500/10 text-sky-200 ring-sky-400/30"
                                : "bg-amber-500/10 text-amber-200 ring-amber-400/30"
                            )}
                          >
                            {row.memberType === "newbie" ? "Newbie" : "Alumni"}
                          </span>
                        </dd>
                      </div>
                    )}
                    {isVisible("sponsorName") && row.sponsorName && (
                      <div className="flex gap-2">
                        <dt className="text-slate-500 w-20 shrink-0">Sponsor</dt>
                        <dd className="text-slate-300">{row.sponsorName}</dd>
                      </div>
                    )}
                    {isVisible("hasFullPayment") && (
                      <div className="flex gap-2">
                        <dt className="text-slate-500 w-20 shrink-0">Full Pmt</dt>
                        <dd>
                          <PaidCell row={row} onToggle={handleTogglePaid} />
                        </dd>
                      </div>
                    )}
                    {isVisible("arrival") && (
                      <div className="flex gap-2">
                        <dt className="text-slate-500 w-20 shrink-0">Arrival</dt>
                        <dd className="text-slate-200">
                          {formatDate(row.arrival)}{" "}
                          <span className="text-slate-500">{row.arrivalTime}</span>
                        </dd>
                      </div>
                    )}
                    {isVisible("departure") && (
                      <div className="flex gap-2">
                        <dt className="text-slate-500 w-20 shrink-0">Departure</dt>
                        <dd className="text-slate-200">
                          {formatDate(row.departure)}{" "}
                          <span className="text-slate-500">{row.departureTime}</span>
                        </dd>
                      </div>
                    )}
                    {isVisible("hasBurningManTicket") && (
                      <div className="flex gap-2">
                        <dt className="text-slate-500 w-20 shrink-0">BM Ticket</dt>
                        <dd className={row.hasBurningManTicket ? "text-emerald-300" : "text-slate-500"}>
                          {row.hasBurningManTicket ? "Yes" : "No"}
                        </dd>
                      </div>
                    )}
                    {isVisible("hasVehiclePass") && (
                      <div className="flex gap-2">
                        <dt className="text-slate-500 w-20 shrink-0">Veh. Pass</dt>
                        <dd className={row.hasVehiclePass ? "text-emerald-300" : "text-slate-500"}>
                          {row.hasVehiclePass ? "Yes" : "No"}
                        </dd>
                      </div>
                    )}
                    {isVisible("requests") && row.requests?.trim() && (
                      <div className="flex gap-2">
                        <dt className="text-slate-500 w-20 shrink-0">Requests</dt>
                        <dd className="text-amber-200">{row.requests}</dd>
                      </div>
                    )}
                    {isInvitedTab && row.addedBy && (
                      <div className="flex gap-2">
                        <dt className="text-slate-500 w-20 shrink-0">Added By</dt>
                        <dd className="text-slate-300">{row.addedBy}</dd>
                      </div>
                    )}
                    {isInvitedTab && row.notes && (
                      <div className="flex gap-2">
                        <dt className="text-slate-500 w-20 shrink-0">Notes</dt>
                        <dd className="text-slate-300">{row.notes}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => { void handleToggleCancelled(row); }}
                      disabled={cancellingRowId === row._id}
                      className={clsx(
                        "rounded-lg px-3 py-2 text-xs font-medium ring-1 transition-colors disabled:opacity-40",
                        row.cancelled
                          ? "text-emerald-200 ring-emerald-400/30 hover:bg-emerald-500/10"
                          : "text-red-200 ring-red-400/30 hover:bg-red-500/10"
                      )}
                    >
                      {row.cancelled ? "Reinstate" : "Cancel"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {showAddModal && opsPassword && (
        <AddManualMemberModal
          opsPassword={opsPassword}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {toast && (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
