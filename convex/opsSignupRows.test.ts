import { afterEach, describe, expect, it, vi } from "vitest";
import { Id } from "./_generated/dataModel";
import { backfillOpsSignupRows, upsertOpsSignupRow } from "./opsSignupRows";

function getHandler(functionObject: unknown): Function {
  const maybeHandler = (functionObject as { handler?: unknown; _handler?: unknown }).handler;
  if (typeof maybeHandler === "function") {
    return maybeHandler;
  }

  const maybeInternalHandler = (functionObject as { _handler?: unknown })._handler;
  if (typeof maybeInternalHandler === "function") {
    return maybeInternalHandler;
  }

  throw new Error("Unable to locate Convex handler");
}

describe("upsertOpsSignupRow", () => {
  it("inserts projection row when one does not exist", async () => {
    const applicationId = "app_1" as Id<"applications">;
    const userId = "user_1" as Id<"users">;
    const insertSpy = vi.fn().mockResolvedValue("ops_row_1");
    const patchSpy = vi.fn();

    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({
          _id: applicationId,
          userId,
          email: "alex@example.com",
          firstName: "Alex",
          lastName: "Rivera",
          phone: "+15551231234",
          arrival: "2026-08-29",
          arrivalTime: "11.01 am to 6.00 pm",
          departure: "2026-09-06",
          departureTime: "6.01 pm to 12.00 am",
          status: "pending_payment",
          paymentAllowed: true,
          earlyDepartureRequested: false,
          createdAt: 1000,
        }),
        query: vi.fn((table: string) => {
          if (table === "confirmed_members") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  hasBurningManTicket: true,
                  hasVehiclePass: false,
                  requests: "",
                  notes: "Legacy notes",
                }),
              }),
            };
          }

          if (table === "ops_signup_rows") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue(null),
              }),
            };
          }

          throw new Error(`Unexpected query table ${table}`);
        }),
        insert: insertSpy,
        patch: patchSpy,
      },
    };

    const result = await upsertOpsSignupRow(ctx as never, applicationId);

    expect(result).toEqual({
      operation: "inserted",
      rowId: "ops_row_1",
    });
    expect(insertSpy).toHaveBeenCalledWith(
      "ops_signup_rows",
      expect.objectContaining({
        applicationId,
        userId,
        fullName: "Alex Rivera",
        status: "pending_payment",
        hasBurningManTicket: true,
        hasVehiclePass: false,
        requests: "",
        sourceVersion: 1,
      })
    );
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it("updates existing projection row", async () => {
    const applicationId = "app_2" as Id<"applications">;
    const patchSpy = vi.fn();
    const insertSpy = vi.fn();

    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({
          _id: applicationId,
          userId: "user_2",
          email: "jordan@example.com",
          firstName: "Jordan",
          lastName: "Lee",
          phone: "+15552342345",
          arrival: "2026-08-30",
          arrivalTime: "12:01 am to 11.00 am",
          departure: "2026-09-06",
          departureTime: "6.01 pm to 12.00 am",
          status: "confirmed",
          paymentAllowed: true,
          earlyDepartureRequested: false,
          createdAt: 2000,
        }),
        query: vi.fn((table: string) => {
          if (table === "confirmed_members") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  hasBurningManTicket: false,
                  hasVehiclePass: true,
                  requests: undefined,
                  notes: "Needs rideshare",
                }),
              }),
            };
          }
          if (table === "ops_signup_rows") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({ _id: "ops_row_2" }),
              }),
            };
          }
          throw new Error(`Unexpected query table ${table}`);
        }),
        patch: patchSpy,
        insert: insertSpy,
      },
    };

    const result = await upsertOpsSignupRow(ctx as never, applicationId);

    expect(result).toEqual({
      operation: "updated",
      rowId: "ops_row_2",
    });
    expect(patchSpy).toHaveBeenCalledWith(
      "ops_row_2",
      expect.objectContaining({
        fullName: "Jordan Lee",
        requests: "Needs rideshare",
        hasVehiclePass: true,
        sourceVersion: 1,
      })
    );
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe("backfillOpsSignupRows", () => {
  const originalOpsPwd = process.env.OPS_PWD;

  afterEach(() => {
    if (originalOpsPwd === undefined) {
      delete process.env.OPS_PWD;
    } else {
      process.env.OPS_PWD = originalOpsPwd;
    }
    vi.restoreAllMocks();
  });

  it("throws when ops password is invalid", async () => {
    process.env.OPS_PWD = "correct-password";
    const handler = getHandler(backfillOpsSignupRows);
    const ctx = {
      db: {
        query: vi.fn(),
      },
    };

    await expect(
      handler(ctx, { opsPassword: "wrong-password", dryRun: true })
    ).rejects.toThrow("Unauthorized: Invalid ops password");
    expect(ctx.db.query).not.toHaveBeenCalled();
  });

  it("reports dry-run insert/update counts", async () => {
    process.env.OPS_PWD = "correct-password";
    const handler = getHandler(backfillOpsSignupRows);

    const applications = [{ _id: "app_1" }, { _id: "app_2" }];
    const firstCalls: Record<string, number> = {};

    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table === "applications") {
            return {
              collect: vi.fn().mockResolvedValue(applications),
            };
          }

          if (table === "ops_signup_rows") {
            return {
              withIndex: (_name: string, cb: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
                let currentId = "";
                cb({
                  eq: (_field: string, value: unknown) => {
                    currentId = String(value);
                    return value;
                  },
                });

                firstCalls[currentId] = (firstCalls[currentId] ?? 0) + 1;

                return {
                  first: vi
                    .fn()
                    .mockResolvedValue(currentId === "app_1" ? null : { _id: "row_existing" }),
                };
              },
            };
          }

          throw new Error(`Unexpected query table ${table}`);
        }),
      },
    };

    const result = await handler(ctx, {
      opsPassword: "correct-password",
      dryRun: true,
    });

    expect(result).toMatchObject({
      success: true,
      dryRun: true,
      scanned: 2,
      inserted: 1,
      updated: 1,
      skipped: 0,
      sourceVersion: 1,
    });
  });
});
