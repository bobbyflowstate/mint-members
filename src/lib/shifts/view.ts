import type { ShiftRow, ShiftViewState } from "./types";
import { foldForSearch } from "../search/fold";

/** Trim + case-fold + accent-fold, so "dupre" matches "Dupré". */
const normalized = (value: string) => foldForSearch(value.trim());
const assignee = (row: ShiftRow) =>
  row.firstName || row.lastName ? `${row.firstName} ${row.lastName}`.trim() : "Unassigned";

export function applyShiftView(rows: ShiftRow[], view: ShiftViewState): ShiftRow[] {
  const firstFilter = normalized(view.firstName);
  const lastFilter = normalized(view.lastName);
  const filtered = rows.filter((row) => {
    const isUnassigned = !row.firstName && !row.lastName;
    const firstValue = isUnassigned ? "unassigned" : row.firstName;
    const lastValue = isUnassigned ? "unassigned" : row.lastName;
    return (
      normalized(firstValue).includes(firstFilter) &&
      normalized(lastValue).includes(lastFilter) &&
      (!view.date || row.date === view.date) &&
      (!view.task || row.task === view.task)
    );
  });

  return [...filtered].sort((a, b) => {
    const aValue =
      view.sortField === "firstName" && !a.firstName ? assignee(a) : a[view.sortField];
    const bValue =
      view.sortField === "firstName" && !b.firstName ? assignee(b) : b[view.sortField];
    const result = aValue.localeCompare(bValue, undefined, { sensitivity: "base" });
    return view.sortDirection === "asc" ? result : -result;
  });
}
