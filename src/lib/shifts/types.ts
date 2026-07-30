export interface ShiftRow {
  date: string;
  task: string;
  startTime: string;
  endTime: string;
  firstName: string;
  lastName: string;
}

export type ShiftSortField = "firstName" | "lastName" | "date" | "task";
export type SortDirection = "asc" | "desc";

export interface ShiftViewState {
  firstName: string;
  lastName: string;
  date: string;
  task: string;
  sortField: ShiftSortField;
  sortDirection: SortDirection;
}
