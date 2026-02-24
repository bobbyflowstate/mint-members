import { describe, expect, it } from "vitest";
import { normalizeConfirmedMemberDetails } from "./normalize";

describe("normalizeConfirmedMemberDetails", () => {
  it("should keep provided boolean values", () => {
    const result = normalizeConfirmedMemberDetails({
      hasBurningManTicket: true,
      hasVehiclePass: false,
      requests: "Bringing shared shade",
    });

    expect(result).toEqual({
      hasBurningManTicket: true,
      hasVehiclePass: false,
      requests: "Bringing shared shade",
      notes: "Bringing shared shade",
    });
  });

  it("should default missing booleans to false and trim requests", () => {
    const result = normalizeConfirmedMemberDetails({
      requests: "   Need camp parking spot   ",
    });

    expect(result).toEqual({
      hasBurningManTicket: false,
      hasVehiclePass: false,
      requests: "Need camp parking spot",
      notes: "Need camp parking spot",
    });
  });

  it("should unset blank requests", () => {
    const result = normalizeConfirmedMemberDetails({
      hasBurningManTicket: false,
      hasVehiclePass: true,
      requests: "   ",
    });

    expect(result).toEqual({
      hasBurningManTicket: false,
      hasVehiclePass: true,
      requests: undefined,
    });
  });

  it("should map legacy notes into requests", () => {
    const result = normalizeConfirmedMemberDetails({
      notes: "Need a ride from Reno",
    });

    expect(result.requests).toBe("Need a ride from Reno");
  });
});
