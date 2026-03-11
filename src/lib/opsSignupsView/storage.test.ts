import { describe, expect, it } from "vitest";
import {
  EXPORT_SIGNUPS_VIEW_STORAGE_KEY,
  clearStoredExportViewState,
  loadStoredExportViewState,
  saveExportViewState,
  type ExportViewUiState,
} from "./storage";

const VALID_STATE: ExportViewUiState = {
  visibleColumns: ["firstName", "email", "phone"],
  arrivalOperator: "on_or_before",
  arrivalDate: "2026-08-30",
  departureOperator: "on_or_after",
  departureDate: "2026-09-01",
  statusFilter: "confirmed",
  searchField: "email",
  searchValue: "example.com",
  sortField: "arrival",
  sortDirection: "asc",
  hasBurningManTicketFilter: "yes",
  hasVehiclePassFilter: "no",
  requestsFilter: "has_requests",
};

describe("opsSignupsView storage", () => {
  it("saves and loads export view state", () => {
    saveExportViewState(VALID_STATE);
    const loaded = loadStoredExportViewState();

    expect(loaded).toEqual(VALID_STATE);
  });

  it("returns null for invalid stored payload", () => {
    localStorage.setItem(EXPORT_SIGNUPS_VIEW_STORAGE_KEY, "{broken-json");
    expect(loadStoredExportViewState()).toBeNull();
  });

  it("falls back safely for invalid fields", () => {
    localStorage.setItem(
      EXPORT_SIGNUPS_VIEW_STORAGE_KEY,
      JSON.stringify({
        visibleColumns: ["firstName", "invalid"],
        arrivalOperator: "not_real",
        arrivalDate: 123,
        departureOperator: "before",
        departureDate: "",
        statusFilter: "bad_status",
        searchField: "oops",
        searchValue: null,
        sortField: "also_bad",
        sortDirection: "neither",
        hasBurningManTicketFilter: "maybe",
        hasVehiclePassFilter: 5,
        requestsFilter: "nope",
      })
    );

    const loaded = loadStoredExportViewState();
    expect(loaded).toEqual({
      visibleColumns: ["firstName"],
      arrivalOperator: "on_or_before",
      arrivalDate: "",
      departureOperator: "before",
      departureDate: "",
      statusFilter: "all",
      searchField: "fullName",
      searchValue: "",
      sortField: "createdAt",
      sortDirection: "desc",
      hasBurningManTicketFilter: "any",
      hasVehiclePassFilter: "any",
      requestsFilter: "any",
    });
  });

  it("clears stored state", () => {
    saveExportViewState(VALID_STATE);
    clearStoredExportViewState();

    expect(localStorage.getItem(EXPORT_SIGNUPS_VIEW_STORAGE_KEY)).toBeNull();
    expect(loadStoredExportViewState()).toBeNull();
  });
});
