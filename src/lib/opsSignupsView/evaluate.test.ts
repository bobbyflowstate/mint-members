import { describe, expect, it } from "vitest";
import { compareSignups, matchesSignupFilters } from "./evaluate";
import { SignupFilter } from "./types";

type SignupRow = {
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
  createdAt: number;
  hasBurningManTicket: boolean;
  hasVehiclePass: boolean;
  requests: string;
};

const alex: SignupRow = {
  firstName: "Alex",
  lastName: "Rivera",
  fullName: "Alex Rivera",
  email: "alex@example.com",
  phone: "+15551231234",
  arrival: "2026-08-29",
  arrivalTime: "11.01 am to 6.00 pm",
  departure: "2026-09-06",
  departureTime: "6.01 pm to 12.00 am",
  status: "confirmed",
  createdAt: 100,
  hasBurningManTicket: true,
  hasVehiclePass: false,
  requests: "Needs rideshare",
};

const jordan: SignupRow = {
  firstName: "Jordan",
  lastName: "Lee",
  fullName: "Jordan Lee",
  email: "jordan@example.com",
  phone: "+15552342345",
  arrival: "2026-08-31",
  arrivalTime: "12:01 am to 11.00 am",
  departure: "2026-09-03",
  departureTime: "11.01 am to 6.00 pm",
  status: "pending_payment",
  createdAt: 300,
  hasBurningManTicket: false,
  hasVehiclePass: true,
  requests: "",
};

describe("matchesSignupFilters", () => {
  it("supports arrival on_or_before comparisons", () => {
    const filters: SignupFilter[] = [
      {
        field: "arrival",
        operator: "on_or_before",
        value: "2026-08-30",
      },
    ];

    expect(matchesSignupFilters(alex, filters)).toBe(true);
    expect(matchesSignupFilters(jordan, filters)).toBe(false);
  });

  it("supports departure before comparisons", () => {
    const filters: SignupFilter[] = [
      {
        field: "departure",
        operator: "before",
        value: "2026-09-05",
      },
    ];

    expect(matchesSignupFilters(alex, filters)).toBe(false);
    expect(matchesSignupFilters(jordan, filters)).toBe(true);
  });

  it("supports text contains filters", () => {
    const filters: SignupFilter[] = [
      {
        field: "fullName",
        operator: "contains",
        value: "alex",
      },
    ];

    expect(matchesSignupFilters(alex, filters)).toBe(true);
    expect(matchesSignupFilters(jordan, filters)).toBe(false);
  });

  it("supports status equality filters", () => {
    const filters: SignupFilter[] = [
      {
        field: "status",
        operator: "eq",
        value: "confirmed",
      },
    ];

    expect(matchesSignupFilters(alex, filters)).toBe(true);
    expect(matchesSignupFilters(jordan, filters)).toBe(false);
  });

  it("applies AND semantics across multiple filters", () => {
    const filters: SignupFilter[] = [
      {
        field: "arrival",
        operator: "on_or_before",
        value: "2026-08-30",
      },
      {
        field: "status",
        operator: "eq",
        value: "confirmed",
      },
      {
        field: "phone",
        operator: "contains",
        value: "123",
      },
    ];

    expect(matchesSignupFilters(alex, filters)).toBe(true);
    expect(matchesSignupFilters(jordan, filters)).toBe(false);
  });

  it("supports in operator", () => {
    const filters: SignupFilter[] = [
      {
        field: "status",
        operator: "in",
        values: ["confirmed", "rejected"],
      },
    ];

    expect(matchesSignupFilters(alex, filters)).toBe(true);
    expect(matchesSignupFilters(jordan, filters)).toBe(false);
  });
});

describe("compareSignups", () => {
  it("sorts by createdAt descending", () => {
    const sort = { field: "createdAt" as const, direction: "desc" as const };
    const rows = [alex, jordan].sort((a, b) => compareSignups(sort, a, b));
    expect(rows.map((row) => row.email)).toEqual(["jordan@example.com", "alex@example.com"]);
  });

  it("sorts by arrival ascending", () => {
    const sort = { field: "arrival" as const, direction: "asc" as const };
    const rows = [jordan, alex].sort((a, b) => compareSignups(sort, a, b));
    expect(rows.map((row) => row.email)).toEqual(["alex@example.com", "jordan@example.com"]);
  });
});
