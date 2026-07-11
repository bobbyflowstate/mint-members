import { describe, expect, it } from "vitest";
import { isEarlyDeparture } from "./earlyDeparture";

const CUTOFF = "2025-08-31";

describe("isEarlyDeparture", () => {
  it("is early for any window before the cutoff day", () => {
    expect(isEarlyDeparture("2025-08-30", "6.01 pm to 12.00 am", CUTOFF)).toBe(true);
    expect(isEarlyDeparture("2025-08-25", "12:01 am to 11.00 am", CUTOFF)).toBe(true);
    expect(isEarlyDeparture("2025-08-30", undefined, CUTOFF)).toBe(true);
  });

  it("is early on the cutoff day for morning and day windows", () => {
    expect(isEarlyDeparture("2025-08-31", "12:01 am to 11.00 am", CUTOFF)).toBe(true);
    expect(isEarlyDeparture("2025-08-31", "11.01 am to 6.00 pm", CUTOFF)).toBe(true);
  });

  it("is not early on the cutoff day for the evening window", () => {
    expect(isEarlyDeparture("2025-08-31", "6.01 pm to 12.00 am", CUTOFF)).toBe(false);
  });

  it("is not early after the cutoff day regardless of window", () => {
    expect(isEarlyDeparture("2025-09-01", "12:01 am to 11.00 am", CUTOFF)).toBe(false);
    expect(isEarlyDeparture("2025-09-02", undefined, CUTOFF)).toBe(false);
  });

  it("treats a missing window on the cutoff day as not early", () => {
    expect(isEarlyDeparture("2025-08-31", undefined, CUTOFF)).toBe(false);
  });
});
