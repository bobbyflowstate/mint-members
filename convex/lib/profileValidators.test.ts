import { describe, expect, it, vi } from "vitest";
import { countsForLogistics, listActiveProfiles } from "./profileValidators";

describe("countsForLogistics", () => {
  it("counts any live application status", () => {
    expect(countsForLogistics({ status: "confirmed" })).toBe(true);
    expect(countsForLogistics({ status: "pending_payment" })).toBe(true);
    expect(countsForLogistics({ status: "needs_ops_review" })).toBe(true);
  });

  it("excludes cancelled, rejected, and missing applications", () => {
    expect(countsForLogistics({ status: "confirmed", cancelled: true })).toBe(false);
    expect(countsForLogistics({ status: "rejected" })).toBe(false);
    expect(countsForLogistics(null)).toBe(false);
    expect(countsForLogistics(undefined)).toBe(false);
  });
});

describe("listActiveProfiles", () => {
  it("drops profiles whose application is cancelled or rejected", async () => {
    const applications: Record<string, { status: string; cancelled?: boolean }> = {
      app_active: { status: "confirmed" },
      app_cancelled: { status: "confirmed", cancelled: true },
      app_rejected: { status: "rejected" },
    };

    const profiles = [
      { _id: "profile_1", applicationId: "app_active", vehicleId: "veh_1" },
      { _id: "profile_2", applicationId: "app_cancelled", vehicleId: "veh_1" },
      { _id: "profile_3", applicationId: "app_rejected", vehicleId: "veh_1" },
      { _id: "profile_4", applicationId: "app_missing", vehicleId: "veh_1" },
    ];

    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table === "attendee_profiles") {
            return { collect: vi.fn().mockResolvedValue(profiles) };
          }
          throw new Error(`Unexpected query table ${table}`);
        }),
        get: vi.fn(async (id: string) => applications[id] ?? null),
      },
    };

    const result = await listActiveProfiles(ctx as never);

    expect(result.map((profile) => profile._id)).toEqual(["profile_1"]);
  });
});
