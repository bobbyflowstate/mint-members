import { describe, expect, it } from "vitest";
import {
  DEFAULT_SIGNUPS_VIEW_STATE,
  FILTER_OPERATORS,
  SIGNUP_COLUMN_IDS,
  normalizeSignupViewState,
  isSignupColumnId,
  isFilterOperator,
} from "./types";

describe("opsSignupsView/types", () => {
  it("exposes expected signup column ids including projection fields", () => {
    expect(SIGNUP_COLUMN_IDS).toEqual(
      expect.arrayContaining([
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
      ])
    );
  });

  it("accepts only known column ids", () => {
    expect(isSignupColumnId("email")).toBe(true);
    expect(isSignupColumnId("requests")).toBe(true);
    expect(isSignupColumnId("unknown")).toBe(false);
  });

  it("exposes expected filter operators", () => {
    expect(FILTER_OPERATORS).toEqual(
      expect.arrayContaining([
        "eq",
        "contains",
        "before",
        "after",
        "on_or_before",
        "on_or_after",
        "in",
        "not_empty",
      ])
    );
  });

  it("accepts only known filter operators", () => {
    expect(isFilterOperator("eq")).toBe(true);
    expect(isFilterOperator("on_or_before")).toBe(true);
    expect(isFilterOperator("nope")).toBe(false);
  });

  it("normalizes partial state onto defaults", () => {
    const result = normalizeSignupViewState({
      visibleColumns: ["fullName", "phone", "notAColumn"],
      sort: {
        field: "arrival",
        direction: "asc",
      },
      filters: [],
      limit: 200,
    });

    expect(result.visibleColumns).toEqual(["fullName", "phone"]);
    expect(result.sort).toEqual({ field: "arrival", direction: "asc" });
    expect(result.limit).toBe(200);
  });

  it("falls back safely for invalid state", () => {
    const result = normalizeSignupViewState({
      visibleColumns: [],
      sort: {
        field: "badField",
        direction: "badDirection",
      },
      filters: [
        {
          field: "arrival",
          operator: "on_or_before",
        },
        {
          field: "email",
          operator: "contains",
          value: "",
        },
      ],
      limit: -1,
    });

    expect(result.visibleColumns).toEqual(DEFAULT_SIGNUPS_VIEW_STATE.visibleColumns);
    expect(result.sort).toEqual(DEFAULT_SIGNUPS_VIEW_STATE.sort);
    expect(result.filters).toEqual([]);
    expect(result.limit).toBe(DEFAULT_SIGNUPS_VIEW_STATE.limit);
  });
});
