"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import clsx from "clsx";
import { api } from "../../../convex/_generated/api";
import { buildSignupCsv, downloadCsv, CsvColumn } from "../../lib/opsSignupsView/csv";
import { foldedIncludes } from "../../lib/search/fold";
import { trainingModules } from "../../lib/training/modules";
import type { OpsTrainingModuleCell } from "../../lib/training/opsStatus";
import { STATUS_LABELS, type ModuleStatus } from "../../lib/training/status";
import { MemberNameLink } from "./MemberNameLink";

const OPS_PASSWORD_KEY = "ops_password";

type TrainingTab = "all" | "outstanding" | "complete";

interface TrainingRow {
  applicationId: string;
  fullName: string;
  email: string;
  memberType: string;
  status: string;
  cells: OpsTrainingModuleCell[];
  completeCount: number;
  totalCount: number;
  allComplete: boolean;
  lastActivityAt?: number;
}

const REQUIRED_MODULES = trainingModules.filter((module) => module.required);

const STATUS_PILL: Record<ModuleStatus, string> = {
  complete: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  in_progress: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
  not_started: "bg-white/5 text-slate-400 ring-white/10",
};

const RETAKE_PILL = "bg-amber-400/10 text-amber-300 ring-amber-400/30";

function shortDate(value: number | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Month + year, for a pass from a previous year's module. */
function monthYear(value: number | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function isoDate(value: number | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

/** What a cell says in text — shared by the pill and the CSV. */
function cellLabel(cell: OpsTrainingModuleCell | undefined): string {
  if (!cell) return "";
  if (cell.staleCompletion) return "Retake needed";
  return STATUS_LABELS[cell.status];
}

function findCell(row: TrainingRow, slug: string): OpsTrainingModuleCell | undefined {
  return row.cells.find((cell) => cell.slug === slug);
}

const CSV_COLUMNS: CsvColumn<TrainingRow>[] = [
  { key: "fullName", header: "Name", getValue: (r) => r.fullName },
  { key: "email", header: "Email", getValue: (r) => r.email },
  { key: "memberType", header: "Member Type", getValue: (r) => r.memberType },
  { key: "status", header: "Application Status", getValue: (r) => r.status },
  ...REQUIRED_MODULES.flatMap((module): CsvColumn<TrainingRow>[] => [
    {
      key: `${module.slug}-status`,
      header: module.title,
      getValue: (r) => cellLabel(findCell(r, module.slug)),
    },
    {
      key: `${module.slug}-completed`,
      header: `${module.title} Completed`,
      getValue: (r) => isoDate(findCell(r, module.slug)?.completedAt),
    },
  ]),
  {
    key: "progress",
    header: "Modules Complete",
    getValue: (r) => `${r.completeCount}/${r.totalCount}`,
  },
  {
    key: "lastActivity",
    header: "Last Activity",
    getValue: (r) => isoDate(r.lastActivityAt),
  },
];

export function TrainingTable() {
  const [opsPassword] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(OPS_PASSWORD_KEY) : null
  );
  const [tab, setTab] = useState<TrainingTab>("all");
  const [search, setSearch] = useState("");

  const rows = useQuery(
    api.training.listForOps,
    opsPassword ? { opsPassword } : "skip"
  ) as TrainingRow[] | undefined;

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    const term = search.trim();
    return rows.filter((row) => {
      if (tab === "outstanding" && row.allComplete) return false;
      if (tab === "complete" && !row.allComplete) return false;
      if (!term) return true;
      return foldedIncludes(row.fullName, term) || foldedIncludes(row.email, term);
    });
  }, [rows, tab, search]);

  const completeCount = rows?.filter((row) => row.allComplete).length ?? 0;

  const handleExport = () => {
    const csv = buildSignupCsv(filteredRows, CSV_COLUMNS);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`training-status-${stamp}.csv`, csv);
  };

  if (!opsPassword) {
    return (
      <p className="text-sm text-slate-400">
        Enter the ops password to view training status.
      </p>
    );
  }

  if (rows === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(
            [
              { id: "all", name: `All (${rows.length})` },
              { id: "outstanding", name: `Outstanding (${rows.length - completeCount})` },
              { id: "complete", name: `Trained up (${completeCount})` },
            ] as { id: TrainingTab; name: string }[]
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-all",
                tab === item.id
                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                  : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"
              )}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email…"
            className="rounded-lg border-0 bg-white/5 px-3 py-1.5 text-sm text-white ring-1 ring-inset ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleExport}
            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 transition-all"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr>
              {["Name", ...REQUIRED_MODULES.map((m) => m.title), "Progress", "Last Activity"].map(
                (header) => (
                  <th
                    key={header}
                    className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredRows.map((row) => (
              <tr key={row.applicationId} className="hover:bg-white/5">
                <td className="whitespace-nowrap px-3 py-2.5">
                  <p className="font-medium text-white">
                    <MemberNameLink
                      applicationId={row.applicationId}
                      name={row.fullName}
                    />
                  </p>
                  <p className="text-xs text-slate-400">{row.email}</p>
                </td>
                {REQUIRED_MODULES.map((module) => {
                  const cell = findCell(row, module.slug);
                  const label = cellLabel(cell);
                  return (
                    <td key={module.slug} className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={clsx(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                          cell?.staleCompletion
                            ? RETAKE_PILL
                            : STATUS_PILL[cell?.status ?? "not_started"]
                        )}
                      >
                        {label}
                      </span>
                      {cell?.completedAt ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {shortDate(cell.completedAt)}
                        </p>
                      ) : cell?.previousCompletedAt ? (
                        <p className="mt-1 text-xs text-slate-500">
                          last done {monthYear(cell.previousCompletedAt)}
                        </p>
                      ) : cell?.status === "in_progress" && cell.updatedAt ? (
                        <p className="mt-1 text-xs text-slate-500">
                          saved {shortDate(cell.updatedAt)}
                        </p>
                      ) : null}
                    </td>
                  );
                })}
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span
                    className={clsx(
                      "font-medium",
                      row.allComplete ? "text-emerald-300" : "text-slate-300"
                    )}
                  >
                    {row.completeCount}/{row.totalCount}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">
                  {row.lastActivityAt ? shortDate(row.lastActivityAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-slate-500">
            No members match this view.
          </p>
        )}
      </div>
    </div>
  );
}
