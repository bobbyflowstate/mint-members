import { describe, expect, it } from "vitest";
import {
  TIME_SLOT_ORDER,
  UNKNOWN_TIME_SLOT,
  compareSortValues,
  dateTimeSortValue,
  isBlankSortKey,
  isPaymentEligible,
  sortRows,
} from "./sort";

const MORNING = "12:01 am to 11.00 am";
const AFTERNOON = "11.01 am to 6.00 pm";
const EVENING = "6.01 pm to 12.00 am";

interface Row {
  name: string;
  arrival: string;
  arrivalTime: string;
}

const arrivalColumn = {
  sortValue: (r: Row) => dateTimeSortValue(r.arrival, r.arrivalTime),
  renderText: (r: Row) => `${r.arrival} ${r.arrivalTime}`.trim(),
};

const order = (rows: Row[], direction: "asc" | "desc") =>
  sortRows(rows, arrivalColumn, direction).map((r) => r.name);

describe("dateTimeSortValue", () => {
  it("orders the three time slots chronologically within a date", () => {
    const rows: Row[] = [
      { name: "evening", arrival: "2026-08-24", arrivalTime: EVENING },
      { name: "morning", arrival: "2026-08-24", arrivalTime: MORNING },
      { name: "afternoon", arrival: "2026-08-24", arrivalTime: AFTERNOON },
    ];
    expect(order(rows, "asc")).toEqual(["morning", "afternoon", "evening"]);
    expect(order(rows, "desc")).toEqual(["evening", "afternoon", "morning"]);
  });

  it("orders by date before time slot", () => {
    const rows: Row[] = [
      { name: "late-on-24", arrival: "2026-08-24", arrivalTime: EVENING },
      { name: "early-on-25", arrival: "2026-08-25", arrivalTime: MORNING },
      { name: "late-on-23", arrival: "2026-08-23", arrivalTime: EVENING },
    ];
    expect(order(rows, "asc")).toEqual(["late-on-23", "late-on-24", "early-on-25"]);
  });

  it("sinks rows with no arrival date in both directions", () => {
    const rows: Row[] = [
      { name: "blank", arrival: "", arrivalTime: "" },
      { name: "dated", arrival: "2026-08-24", arrivalTime: AFTERNOON },
      { name: "earlier", arrival: "2026-08-20", arrivalTime: MORNING },
    ];
    expect(order(rows, "asc")).toEqual(["earlier", "dated", "blank"]);
    expect(order(rows, "desc")).toEqual(["dated", "earlier", "blank"]);
  });

  it("returns a blank key for a missing date so the row sinks", () => {
    expect(dateTimeSortValue("", "")).toBe("");
    expect(dateTimeSortValue(undefined, MORNING)).toBe("");
    expect(isBlankSortKey(dateTimeSortValue("", ""))).toBe(true);
  });

  it("places an unrecognized time after the known slots on the same date", () => {
    expect(dateTimeSortValue("2026-08-24", "half past something")).toBe(
      `2026-08-24T${UNKNOWN_TIME_SLOT}`
    );
    expect(UNKNOWN_TIME_SLOT).toBeGreaterThan(Math.max(...Object.values(TIME_SLOT_ORDER)));
  });

  it("keeps a date with a missing time orderable", () => {
    const rows: Row[] = [
      { name: "no-time", arrival: "2026-08-24", arrivalTime: "" },
      { name: "earlier-day", arrival: "2026-08-23", arrivalTime: EVENING },
    ];
    expect(order(rows, "asc")).toEqual(["earlier-day", "no-time"]);
  });
});

describe("isPaymentEligible", () => {
  it("covers manual invites and the in-flight payment statuses", () => {
    expect(isPaymentEligible({ _source: "invite", status: "invited" })).toBe(true);
    expect(isPaymentEligible({ status: "confirmed" })).toBe(true);
    expect(isPaymentEligible({ status: "pending_payment" })).toBe(true);
    expect(isPaymentEligible({ status: "payment_processing" })).toBe(true);
  });

  it("excludes statuses with no payment badge", () => {
    expect(isPaymentEligible({ status: "needs_ops_review" })).toBe(false);
    expect(isPaymentEligible({ status: "rejected" })).toBe(false);
    expect(isPaymentEligible({})).toBe(false);
  });
});

describe("full payment ordering", () => {
  interface PayRow {
    name: string;
    status: string;
    hasFullPayment?: boolean;
    cancelled?: boolean;
    _source?: string;
  }

  // Mirrors the hasFullPayment column in MembersTable: rows showing no badge
  // (cancelled, or not yet eligible) sort as blanks.
  const paymentColumn = {
    sortValue: (r: PayRow) =>
      r.cancelled || !isPaymentEligible(r) ? "" : r.hasFullPayment ? 1 : 0,
    renderText: (r: PayRow) =>
      isPaymentEligible(r) ? (r.hasFullPayment ? "Paid in Full" : "Outstanding") : "",
  };

  const rows: PayRow[] = [
    { name: "paid", status: "confirmed", hasFullPayment: true },
    { name: "owes", status: "pending_payment", hasFullPayment: false },
    { name: "cancelled", status: "confirmed", hasFullPayment: false, cancelled: true },
    { name: "not-eligible", status: "needs_ops_review", hasFullPayment: false },
  ];

  it("leads with the members who still owe money", () => {
    expect(sortRows(rows, paymentColumn, "asc").map((r) => r.name)).toEqual([
      "owes",
      "paid",
      "cancelled",
      "not-eligible",
    ]);
  });

  it("keeps cancelled and ineligible rows below the badged rows when reversed", () => {
    expect(sortRows(rows, paymentColumn, "desc").map((r) => r.name)).toEqual([
      "paid",
      "owes",
      "cancelled",
      "not-eligible",
    ]);
  });
});

describe("compareSortValues", () => {
  it("compares numbers numerically rather than as text", () => {
    expect(compareSortValues(9, 100, "asc")).toBeLessThan(0);
    expect(compareSortValues(9, 100, "desc")).toBeGreaterThan(0);
  });

  it("ignores case when comparing text", () => {
    expect(compareSortValues("alex", "Alex", "asc")).toBe(0);
    expect(compareSortValues("alex", "Brooke", "asc")).toBeLessThan(0);
  });

  it("orders embedded numbers naturally", () => {
    expect(compareSortValues("Tent 2", "Tent 10", "asc")).toBeLessThan(0);
  });

  it("treats two blanks as equal", () => {
    expect(compareSortValues("", "", "asc")).toBe(0);
    expect(compareSortValues("", "", "desc")).toBe(0);
  });

  it("sinks a blank regardless of direction", () => {
    expect(compareSortValues("", "anything", "asc")).toBeGreaterThan(0);
    expect(compareSortValues("", "anything", "desc")).toBeGreaterThan(0);
    expect(compareSortValues("anything", "", "asc")).toBeLessThan(0);
    expect(compareSortValues("anything", "", "desc")).toBeLessThan(0);
  });
});

describe("sortRows", () => {
  it("does not mutate the input array", () => {
    const rows: Row[] = [
      { name: "b", arrival: "2026-08-25", arrivalTime: MORNING },
      { name: "a", arrival: "2026-08-24", arrivalTime: MORNING },
    ];
    const snapshot = rows.map((r) => r.name);
    sortRows(rows, arrivalColumn, "asc");
    expect(rows.map((r) => r.name)).toEqual(snapshot);
  });

  it("falls back to renderText when a column defines no sortValue", () => {
    const rows = [{ label: "zebra" }, { label: "apple" }];
    const sorted = sortRows(rows, { renderText: (r) => r.label }, "asc");
    expect(sorted.map((r) => r.label)).toEqual(["apple", "zebra"]);
  });
});
